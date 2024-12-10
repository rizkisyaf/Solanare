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