import * as Sentry from "@sentry/nextjs"
import { Connection, PublicKey, Transaction, ComputeBudgetProgram } from "@solana/web3.js"
import { SOLANARE_TOKEN } from "./token"
import { logger } from "./logger"
import { getConnection, withFallback, getPriorityFee } from "./rpc"

const JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6"
const MIN_SOL_AMOUNT = 0.01
const SLIPPAGE_BPS = 50
const COMPUTE_UNIT_LIMIT = 200_000
const HOLDER_COOLDOWN = 1800000
const REGULAR_COOLDOWN = 3600000

export async function createBumpTransaction(
  connection: Connection,
  wallet: PublicKey,
  amount = MIN_SOL_AMOUNT
): Promise<Transaction> {
  try {
    // Use withFallback for RPC operations
    return await withFallback(async (conn) => {
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: COMPUTE_UNIT_LIMIT
      });

      // Get priority fee using our utility
      const priorityFee = await getPriorityFee(conn);
      const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFee
      });

      const quote = await fetch(
        `${JUPITER_QUOTE_API}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${SOLANARE_TOKEN}&amount=${amount * 1e9}&slippageBps=${SLIPPAGE_BPS}`
      );
      
      if (!quote.ok) throw new Error(`Quote failed: ${quote.statusText}`);
      const quoteData = await quote.json();

      const swapResponse = await fetch(`${JUPITER_QUOTE_API}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quoteData,
          userPublicKey: wallet.toString(),
          wrapUnwrapSOL: true,
          computeUnitPriceMicroLamports: priorityFee,
          asLegacyTransaction: true
        })
      });

      if (!swapResponse.ok) throw new Error(`Swap failed: ${swapResponse.statusText}`);
      const { swapTransaction } = await swapResponse.json();

      const tx = Transaction.from(Buffer.from(swapTransaction, 'base64'));
      tx.instructions.unshift(computeBudgetIx, priorityFeeIx);
      
      return tx;
    }, connection);

  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        wallet: wallet.toString(),
        amount: amount.toString(),
        operation: 'jupiter_swap'
      }
    });
    throw error;
  }
}

export function getCooldownTime(isHolder: boolean): number {
  return isHolder ? HOLDER_COOLDOWN : REGULAR_COOLDOWN;
} 