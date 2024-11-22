import { PublicKey, Connection } from "@solana/web3.js"
import { logger } from "./logger"

export interface SecurityCheck {
  isScam: boolean
  risk: 'low' | 'medium' | 'high'
  details?: string
}

export async function checkTransactionSecurity(
  connection: Connection,
  walletAddress: PublicKey,
  transactionData: any
): Promise<SecurityCheck> {
  try {
    const response = await fetch('https://lookup-api.scamsniffer.io/address/check', {
      method: 'POST',
      body: JSON.stringify({
        wallet: walletAddress.toString(),
        transaction: transactionData,
        chain: 'solana'
      })
    })

    if (!response.ok) {
      return {
        isScam: false,
        risk: 'low',
        details: 'Security check unavailable'
      }
    }

    const security = await response.json()
    return {
      isScam: security.isScam || false,
      risk: security.riskLevel || 'low',
      details: security.details || ''
    }
  } catch (error) {
    logger.error('Security check failed', { error })
    return {
      isScam: false,
      risk: 'low',
      details: 'Security check failed'
    }
  }
}