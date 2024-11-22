import { Commitment, Connection } from '@solana/web3.js'
import { logger } from './logger'

const MAX_RETRIES = 3
const RETRY_DELAY = 2000 // 2 seconds
const MAX_BATCH_SIZE = 2
const RATE_LIMIT_COOLDOWN = 30000 // 30 seconds

export function getConnection(commitment: Commitment = 'processed') {
  const handleResponse = async (response: Response) => {
    if (response.status === 429) {
      logger.warn('Rate limit reached, cooling down', {
        details: { cooldown: RATE_LIMIT_COOLDOWN }
      })
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_COOLDOWN))
      throw new Error('RATE_LIMIT')
    }
    return response
  }

  return new Connection(
    process.env.NEXT_PUBLIC_RPC_ENDPOINT!,
    {
      commitment,
      confirmTransactionInitialTimeout: 60000,
      wsEndpoint: undefined,
      fetch: async (url, options) => {
        for (let i = 0; i < MAX_RETRIES; i++) {
          try {
            const response = await fetch(url, {
              ...options,
              headers: {
                'Content-Type': 'application/json',
              }
            })
            return handleResponse(response)
          } catch (error) {
            if (i === MAX_RETRIES - 1) throw error
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          }
        }
        throw new Error('Max retries exceeded')
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

export async function getPriorityFee(encodedTransaction: string): Promise<number> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/rpc`, {
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