import { Connection, PublicKey, Transaction, ComputeBudgetProgram } from "@solana/web3.js"
import { SOLANARE_TOKEN } from "./token"

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6"
const MIN_SOL_AMOUNT = 0.05
const SLIPPAGE_BPS = 100
const COMPUTE_UNIT_LIMIT = 400_000
const PRIORITY_FEE_MULTIPLIER = 2
const HOLDER_COOLDOWN = 30 * 60 * 1000 // 30 minutes in ms
const NORMAL_COOLDOWN = 60 * 60 * 1000 // 60 minutes in ms

export const jitoTipAccounts = [
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
]

export async function createBumpTransaction(
  connection: Connection,
  wallet: PublicKey,
): Promise<Transaction> {
  try {
    // Get current priority fee
    const recentPriority = await connection.getRecentPrioritizationFees()
    const medianFee = recentPriority.reduce((a, b) => a + b.prioritizationFee, 0) / recentPriority.length
    const priorityFee = Math.ceil(medianFee * PRIORITY_FEE_MULTIPLIER)

    // Setup compute budget
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: COMPUTE_UNIT_LIMIT
    })
    const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFee
    })

    // Get Jupiter quote
    const quote = await fetch(
      `${JUPITER_QUOTE_API}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${SOLANARE_TOKEN}&amount=${MIN_SOL_AMOUNT * 1e9}&slippageBps=${SLIPPAGE_BPS}`
    )
    
    if (!quote.ok) throw new Error(`Quote failed: ${quote.statusText}`)
    const quoteData = await quote.json()

    // Add Jito tip instruction
    const tipAccount = jitoTipAccounts[Math.floor(Math.random() * jitoTipAccounts.length)]
    
    const swapResponse = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: wallet.toString(),
        wrapUnwrapSOL: true,
        computeUnitPriceMicroLamports: priorityFee,
        prioritizationFeeLamports: 10000,
        asLegacyTransaction: true,
        destinationTokenAccount: tipAccount
      })
    })

    if (!swapResponse.ok) throw new Error(`Swap failed: ${swapResponse.statusText}`)
    const { swapTransaction } = await swapResponse.json()

    const tx = Transaction.from(Buffer.from(swapTransaction, 'base64'))
    tx.instructions.unshift(computeBudgetIx, priorityFeeIx)
    
    return tx
  } catch (error) {
    console.error('Jupiter swap error:', error)
    throw error
  }
}

export function getCooldownTime(isHolder: boolean): number {
  return isHolder ? HOLDER_COOLDOWN : NORMAL_COOLDOWN
} 