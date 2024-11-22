import { Commitment, Connection } from '@solana/web3.js'
import { logger } from './logger'

export const RPC_ENDPOINTS = [
  'https://mercedes-iuhmrd-fast-mainnet.helius-rpc.com',
  'https://solana-mainnet.g.alchemy.com/v2/C191ERIvh8Hz0SAcEpq2_F3jr4wbMbHR',
  'https://api.mainnet-beta.solana.com'
];

let currentEndpointIndex = 0;

export function getConnection(commitment: Commitment = 'confirmed'): Connection {
  const endpoint = RPC_ENDPOINTS[currentEndpointIndex];
  return new Connection(endpoint, {
    commitment,
    confirmTransactionInitialTimeout: 60000,
    wsEndpoint: endpoint.replace('https://', 'wss://'),
  });
}

export function rotateEndpoint() {
  currentEndpointIndex = (currentEndpointIndex + 1) % RPC_ENDPOINTS.length;
}

export async function withFallback<T>(
  operation: (connection: Connection) => Promise<T>,
  _connection: Connection,
  headers?: Record<string, string>
): Promise<T> {
  let attempts = 0;
  const maxAttempts = RPC_ENDPOINTS.length * 2;

  while (attempts < maxAttempts) {
    try {
      const modifiedConnection = getConnection(_connection.commitment);
      
      if (headers) {
        const originalRequest = (modifiedConnection as any)._rpcRequest;
        (modifiedConnection as any)._rpcRequest = async function (...args: any[]) {
          if (args[1] && typeof args[1] === 'object') {
            args[1].headers = { ...args[1].headers, ...headers };
          } else {
            args[1] = { headers };
          }
          return await originalRequest.apply(this, args);
        };
      }

      return await operation(modifiedConnection);
    } catch (error) {
      attempts++;
      
      if (attempts === maxAttempts) {
        logger.error('All RPC attempts failed:', {
          error,
          details: {
            attempts,
            currentEndpoint: RPC_ENDPOINTS[currentEndpointIndex]
          }
        });
        throw error;
      }

      // Rotate to next endpoint
      rotateEndpoint();
      
      // Add delay between retries
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw new Error('Failed after all attempts');
}