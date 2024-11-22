import { Commitment, Connection } from '@solana/web3.js'
import { logger } from './logger'

const RPC_ENDPOINT = 'https://mercedes-iuhmrd-fast-mainnet.helius-rpc.com';

export function getConnection(commitment: Commitment = 'processed'): Connection {
  return new Connection(RPC_ENDPOINT, {
    commitment,
    confirmTransactionInitialTimeout: 60000,
    wsEndpoint: RPC_ENDPOINT.replace('https://', 'wss://'),
    httpHeaders: {
      'Origin': 'https://www.solanare.claims',
      'Content-Type': 'application/json',
    }
  });
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
  const response = await fetch(RPC_ENDPOINT, {
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