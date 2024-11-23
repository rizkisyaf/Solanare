import { Connection, PublicKey, Transaction, ComputeBudgetProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js"
import { createCloseAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { logger } from "./logger"
import { getPriorityFee } from "./rpc"
import bs58 from 'bs58'

const TRANSACTION_TIMEOUT = 60000 // 60 seconds
const CONFIRMATION_INTERVAL = 5000 // 5 seconds
const COMPUTE_UNIT_LIMIT = 1_400_000 // Maximum compute units
const COMPUTE_UNIT_PRICE = 1_000 // Base price in microlamports

export async function closeTokenAccount(
  connection: Connection,
  wallet: PublicKey,
  tokenAccount: PublicKey,
  sendTransaction: (transaction: Transaction | VersionedTransaction, connection: Connection) => Promise<string>
) {
  try {
    const { blockhash } = await connection.getLatestBlockhash('confirmed')
    
    const closeInstruction = createCloseAccountInstruction(
      tokenAccount,  // Source account (token account to close)
      wallet,        // Destination account (SOL account to receive rent)
      wallet,        // Owner of the token account
      [],           // No multisig signers
      TOKEN_PROGRAM_ID
    )

    const transaction = new Transaction()
    transaction.add(closeInstruction)
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