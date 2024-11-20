import { Connection } from '@solana/web3.js'
import { logger } from './logger'

const RPC_ENDPOINTS = [
  'https://mercedes-iuhmrd-fast-mainnet.helius-rpc.com',
  'https://rpc.shyft.to?api_key=GXtK2hRLup638NN_',
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.g.alchemy.com/v2/C191ERIvh8Hz0SAcEpq2_F3jr4wbMbHR'
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