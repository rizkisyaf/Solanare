import { Connection } from '@solana/web3.js'
import { logger } from './logger'

const RPC_ENDPOINTS = [
  'https://mercedes-iuhmrd-fast-mainnet.helius-rpc.com',
]

export const withFallback = async <T>(
  operation: (connection: Connection) => Promise<T>,
  initialConnection: Connection
): Promise<T> => {
  const endpoints = [initialConnection.rpcEndpoint, ...RPC_ENDPOINTS]
  
  for (const endpoint of endpoints) {
    try {
      const connection = endpoint === initialConnection.rpcEndpoint 
        ? initialConnection 
        : new Connection(endpoint)
      
      return await operation(connection)
    } catch (error) {
      logger.error(`RPC error with endpoint ${endpoint}:`, error)
      continue
    }
  }
  
  throw new Error('All RPC endpoints failed')
} 