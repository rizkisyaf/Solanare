import { Commitment, Connection } from '@solana/web3.js'
import { logger } from './logger'

const MAX_RETRIES = 0  // Per Helius best practices
const RATE_LIMIT_COOLDOWN = 30000

export function getConnection(commitment: Commitment = 'processed') {
  const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_HELIUS_API_KEY is not defined')
  }

  const endpoint = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`

  return new Connection(
    endpoint,
    {
      commitment,
      confirmTransactionInitialTimeout: 60000,
      wsEndpoint: undefined,
      fetch: async (url, options) => {
        try {
          const response = await fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
            }
          })

          if (response.status === 429) {
            logger.warn('Rate limit reached, cooling down')
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_COOLDOWN))
            throw new Error('RATE_LIMIT')
          }

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          // Log staked connection status per Helius best practices
          const connectionType = response.headers.get('X-Helius-ConnectionType')
          if (connectionType) {
            logger.info('Helius connection type:', { type: connectionType })
          }

          return response
        } catch (error) {
          logger.error('RPC request failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
          throw error
        }
      }
    }
  )
}

export async function withFallback<T>(
  operation: (connection: Connection) => Promise<T>,
  _connection: Connection,
  headers?: Record<string, string>
): Promise<T> {
  try {
    const connection = getConnection(_connection.commitment);
    return await operation(connection);
  } catch (error) {
    logger.error('RPC operation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      operation: operation.name
    });
    throw error;
  }
}

export async function getPriorityFee(connection: Connection): Promise<number> {
  try {
    const response = await fetch('/api/rpc', {
      method: 'POST',
      body: JSON.stringify({ method: 'getPriorityFee' })
    })
    const data = await response.json();
    return data?.result?.priorityFee || 1;
  } catch (error) {
    logger.error('RPC operation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      operation: 'getPriorityFee'
    });
    throw error;
  }
}

export async function getTokenMetadata(connection: Connection, mint: string) {
  // Handle native SOL
  if (mint === 'So11111111111111111111111111111111111111112') {
    return {
      name: 'Solana',
      symbol: 'SOL',
      usdValue: await getSolPrice(),
      decimals: 9
    };
  }
  
  // Handle Wrapped SOL
  if (mint === 'So11111111111111111111111111111111111111113') {
    return {
      name: 'Wrapped SOL',
      symbol: 'WSOL',
      usdValue: await getSolPrice(),
      decimals: 9
    };
  }

  try {
    const response = await fetch('https://mainnet.helius-rpc.com/?api-key=' + process.env.NEXT_PUBLIC_HELIUS_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'helius-metadata',
        method: 'getAsset',
        params: {
          id: mint,
          displayOptions: {
            showFungible: true
          }
        },
      }),
    });
    
    const { result: asset } = await response.json();
    
    return {
      name: asset.token_info?.name || asset.content?.metadata?.name || 'Unknown',
      symbol: asset.token_info?.symbol || asset.content?.metadata?.symbol || 'Unknown',
      usdValue: asset.token_info?.price_info?.price_per_token || 0,
      decimals: asset.token_info?.decimals || 0
    };
  } catch (error) {
    logger.error('Error fetching token metadata', { error, mint });
    return null;
  }
}

// Add helper function to get SOL price
export async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    return data.solana.usd;
  } catch (error) {
    logger.error('Error fetching SOL price', { error });
    return 0;
  }
}