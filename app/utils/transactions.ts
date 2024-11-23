import { Connection, PublicKey, Transaction, ComputeBudgetProgram, TransactionMessage, VersionedTransaction, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js"
import { createCloseAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { logger } from "./logger"
import { getPriorityFee } from "./rpc"
import bs58 from 'bs58'
import { RENT_EXEMPTION, PLATFORM_FEE_PERCENTAGE, TREASURY_WALLET } from "./constants"

// Transaction configuration constants - kept for future optimization
export const TRANSACTION_TIMEOUT = 30000; // 30 seconds
export const CONFIRMATION_INTERVAL = 1000; // 1 second
export const COMPUTE_UNIT_LIMIT = 200_000;
export const COMPUTE_UNIT_PRICE = 15_000;

export async function closeTokenAccount(
  connection: Connection,
  wallet: PublicKey,
  tokenAccount: PublicKey,
  sendTransaction: (transaction: Transaction | VersionedTransaction, connection: Connection) => Promise<string>
) {
  try {
    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    
    // Calculate fee amount
    const feeAmount = RENT_EXEMPTION * PLATFORM_FEE_PERCENTAGE * LAMPORTS_PER_SOL;
    
    // Create close account instruction
    const closeInstruction = createCloseAccountInstruction(
      tokenAccount,  // Source account (token account to close)
      wallet,        // Destination account (SOL account to receive rent)
      wallet,        // Owner of the token account
      [],           // No multisig signers
      TOKEN_PROGRAM_ID
    )

    // Create transfer instruction for platform fee
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: wallet,
      toPubkey: TREASURY_WALLET,
      lamports: feeAmount
    });

    const transaction = new Transaction()
    transaction.add(closeInstruction)
    transaction.add(transferInstruction)
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