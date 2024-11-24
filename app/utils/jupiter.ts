import { Connection, PublicKey, Transaction } from "@solana/web3.js"
import { SOLANARE_TOKEN } from "./token"

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6"
const MIN_SOL_AMOUNT = 0.01
const SLIPPAGE_BPS = 100
const HOLDER_COOLDOWN = 30 * 60 * 1000
const NORMAL_COOLDOWN = 60 * 60 * 1000
const PLATFORM_FEE_BPS = 200 // 2% fee
const REFERRAL_ACCOUNT = new PublicKey("FMeQzCuuqWvqFHEbvYJbdZBJa4fqbmwBjDbLKPBuyTjF")

export async function createBumpTransaction(
  connection: Connection,
  wallet: PublicKey,
  amount: number = 0.01
): Promise<Transaction> {
  try {
    if (amount < MIN_SOL_AMOUNT) {
      throw new Error(`Minimum amount is ${MIN_SOL_AMOUNT} SOL`)
    }

    // Get fee account for SOL (input token)
    const [feeAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("referral_ata"),
        REFERRAL_ACCOUNT.toBuffer(),
        new PublicKey("So11111111111111111111111111111111111111112").toBuffer()
      ],
      new PublicKey("REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3")
    )

    const quoteUrl = new URL(`${JUPITER_QUOTE_API}/quote`)
    quoteUrl.searchParams.append("inputMint", "So11111111111111111111111111111111111111112")
    quoteUrl.searchParams.append("outputMint", SOLANARE_TOKEN.toString())
    quoteUrl.searchParams.append("amount", (amount * 1e9).toString())
    quoteUrl.searchParams.append("slippageBps", SLIPPAGE_BPS.toString())
    quoteUrl.searchParams.append("platformFeeBps", PLATFORM_FEE_BPS.toString())

    const quoteResponse = await fetch(quoteUrl.toString())
    if (!quoteResponse.ok) throw new Error(`Quote failed: ${quoteResponse.statusText}`)
    const quoteData = await quoteResponse.json()

    const swapResponse = await fetch(`${JUPITER_QUOTE_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: wallet.toString(),
        wrapAndUnwrapSol: true,
        asLegacyTransaction: true,
        feeAccount: feeAccount.toString(),
        prioritizationFeeLamports: "auto",
        dynamicComputeUnitLimit: true
      })
    })

    if (!swapResponse.ok) {
      const error = await swapResponse.json()
      throw new Error(`Swap failed: ${JSON.stringify(error)}`)
    }
    
    const { swapTransaction } = await swapResponse.json()
    return Transaction.from(Buffer.from(swapTransaction, 'base64'))
  } catch (error) {
    console.error('Jupiter swap error:', error)
    throw error
  }
}

export function getCooldownTime(isHolder: boolean): number {
  return isHolder ? HOLDER_COOLDOWN : NORMAL_COOLDOWN
} 