import { Connection, PublicKey, Transaction, ComputeBudgetProgram, TransactionMessage, VersionedTransaction, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js"
import { createCloseAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { logger } from "./logger"
import { getPriorityFee } from "./rpc"
import bs58 from 'bs58'
import { RENT_EXEMPTION, PLATFORM_FEE_PERCENTAGE, TREASURY_WALLET, TOKEN_HOLDER_FEE_PERCENTAGE } from "./constants"

// Transaction configuration constants - kept for future optimization
export const TRANSACTION_TIMEOUT = 30000; // 30 seconds
export const CONFIRMATION_INTERVAL = 1000; // 1 second
export const COMPUTE_UNIT_LIMIT = 200_000;
export const COMPUTE_UNIT_PRICE = 15_000;

export async function closeTokenAccount(
  connection: Connection,
  wallet: PublicKey,
  tokenAccount: PublicKey,
  sendTransaction: (transaction: Transaction | VersionedTransaction, connection: Connection) => Promise<string>,
  isTokenHolder: boolean
) {
  try {
    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    
    // Calculate fee amount (ensure integer value for lamports)
    const feePercentage = isTokenHolder ? TOKEN_HOLDER_FEE_PERCENTAGE : PLATFORM_FEE_PERCENTAGE
    const feeAmount = Math.floor(RENT_EXEMPTION * feePercentage * LAMPORTS_PER_SOL);
    
    // Create close account instruction that sends rent to an intermediate account
    const closeInstruction = createCloseAccountInstruction(
      tokenAccount,    // Source account (token account to close)
      TREASURY_WALLET, // Destination account (temporary holder for rent)
      wallet,          // Owner of the token account
      [],             // No multisig signers
      TOKEN_PROGRAM_ID
    )

    // Create transfer instruction to send rent minus fee back to user
    const returnRentInstruction = SystemProgram.transfer({
      fromPubkey: TREASURY_WALLET,
      toPubkey: wallet,
      lamports: Math.floor(RENT_EXEMPTION * LAMPORTS_PER_SOL * (1 - feeAmount))
    });

    const transaction = new Transaction()
    transaction.add(closeInstruction)
    transaction.add(returnRentInstruction)
    transaction.feePayer = wallet
    transaction.recentBlockhash = blockhash

    // Sign and send transaction
    const signature = await sendTransaction(transaction, connection)
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
    })

    if (confirmation.value.err) {
      throw new Error('Transaction failed')
    }

    return { signature }

  } catch (error) {
    logger.error('Failed to close token account', {
      error,
      tokenAccount: tokenAccount.toString()
    })
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function createCloseAccountMessage(
  connection: Connection,
  owner: PublicKey,
  accountToClose: PublicKey
): Promise<Transaction> {
  return new Transaction().add(
    createCloseAccountInstruction(
      accountToClose,
      owner,
      owner
    )
  )
}