import { Connection, PublicKey, Transaction, ComputeBudgetProgram } from "@solana/web3.js"
import { SOLANARE_TOKEN } from "./token"

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6"
const MIN_SOL_AMOUNT = 0.01
const SLIPPAGE_BPS = 100
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
  amount: number = 0.01
): Promise<Transaction> {
  try {
    if (amount < MIN_SOL_AMOUNT) {
      throw new Error(`Minimum amount is ${MIN_SOL_AMOUNT} SOL`);
    }

    // Get Jupiter quote with dynamic amount
    const quote = await fetch(
      `${JUPITER_QUOTE_API}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${SOLANARE_TOKEN}&amount=${amount * 1e9}&slippageBps=${SLIPPAGE_BPS}`
    )
    
    if (!quote.ok) throw new Error(`Quote failed: ${quote.statusText}`)
    const quoteData = await quote.json()

    // Get swap transaction
    const swapResponse = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: wallet.toString(),
        wrapUnwrapSol: true,
        computeUnitPriceMicroLamports: 'auto',
        prioritizationFeeLamports: 'auto',
        asLegacyTransaction: true,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: { maxBps: 300 }
      })
    })

    if (!swapResponse.ok) throw new Error(`Swap failed: ${swapResponse.statusText}`)
    const { swapTransaction } = await swapResponse.json()

    const tx = Transaction.from(Buffer.from(swapTransaction, 'base64'))
    return tx
  } catch (error) {
    console.error('Jupiter swap error:', error)
    throw error
  }
}

export function getCooldownTime(isHolder: boolean): number {
  return isHolder ? HOLDER_COOLDOWN : NORMAL_COOLDOWN
} 