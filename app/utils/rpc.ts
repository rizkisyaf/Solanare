import { Commitment, Connection } from '@solana/web3.js'
import { logger } from './logger'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://www.solanare.claims'

export function getConnection(commitment: Commitment = 'processed') {
  const rpcUrl = `${API_BASE_URL}/api/rpc`
  
  return new Connection(rpcUrl, {
    commitment,
    confirmTransactionInitialTimeout: 60000,
    wsEndpoint: undefined,
    fetch: async (url, options) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: options?.body,
          credentials: 'include'
        })
        
        if (!response.ok) {
          throw new Error(`RPC request failed: ${response.statusText}`)
        }
        
        return response
      } catch (error) {
        logger.error('RPC request failed', { error })
        throw error
      }
    }
  })
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

export async function getPriorityFee(encodedTransaction: string): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/api/rpc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'priority-fee',
      method: 'getPriorityFeeEstimate',
      params: [{
        transaction: encodedTransaction,
        options: { recommended: true }
      }]
    })
  });

  const data = await response.json();
  return data?.result?.priorityFee || 1;
}