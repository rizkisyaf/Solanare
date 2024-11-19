import { PublicKey, Connection } from "@solana/web3.js"

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
  // Integration with ScamSniffers API
  const response = await fetch('https://lookup-api.scamsniffer.io/address/check', {
    method: 'POST',
    body: JSON.stringify({
      wallet: walletAddress.toString(),
      transaction: transactionData,
      chain: 'solana'
    })
  })

  const security = await response.json()
  return {
    isScam: security.isScam,
    risk: security.riskLevel,
    details: security.details
  }
} 