import { PublicKey } from "@solana/web3.js"
import { logger } from "./logger"
import { getConnection, withFallback } from "./rpc"

export const SOLANARE_TOKEN = new PublicKey("14ornfnSSU2Gr23hhru7mAUpUM68H4rx13B2YMWb6ume")
const MIN_TOKENS_FOR_BENEFITS = 5000000

export async function checkTokenHolder(wallet: PublicKey) {
  try {
    const connection = getConnection()
    const checkBalance = async () => {
      const accounts = await connection.getTokenAccountsByOwner(wallet, { mint: SOLANARE_TOKEN })
      if (!accounts.value.length) return false
      
      const balance = await connection.getTokenAccountBalance(accounts.value[0].pubkey)
      return parseInt(balance.value.amount) >= MIN_TOKENS_FOR_BENEFITS
    }

    return await withFallback(checkBalance, connection)
  } catch (error) {
    logger.error('Token check failed:', { wallet: wallet.toString() })
    return false
  }
} 