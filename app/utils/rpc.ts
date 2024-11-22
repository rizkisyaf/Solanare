import { Commitment, Connection } from '@solana/web3.js'
import { logger } from './logger'

export function getConnection(commitment: Commitment = 'confirmed') {
  const rpcUrl = '/api/rpc'
  return new Connection(rpcUrl, {
    commitment,
    fetch: async (url, options) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: options?.body
      })
      return response
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
  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`, {
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
  return data.result.priorityFeeEstimate;
}