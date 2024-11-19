import { Connection, PublicKey, Transaction } from "@solana/web3.js"
import { createCloseAccountInstruction } from "@solana/spl-token"
import { logger } from "./logger"

interface TransactionResult {
  signature: string
  error?: string
}

const TRANSACTION_TIMEOUT = 30000; // 30 seconds

const confirmTransaction = async (connection: Connection, signature: string) => {
  const startTime = Date.now();
  while (Date.now() - startTime < TRANSACTION_TIMEOUT) {
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) throw new Error('Transaction failed');
    if (confirmation) return confirmation;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Transaction confirmation timeout');
};

export async function closeTokenAccount(
  connection: Connection,
  publicKey: PublicKey,
  tokenAccount: PublicKey,
  treasuryWallet: PublicKey,
  feePercentage: number,
  sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>
): Promise<TransactionResult> {
  try {
    const RENT_EXEMPTION = 0.00203928
    const feeAmount = RENT_EXEMPTION * feePercentage
    const userAmount = RENT_EXEMPTION - feeAmount

    const transaction = new Transaction()
    
    // Create instructions for fee and user
    const feeInstruction = createCloseAccountInstruction(
      tokenAccount,
      treasuryWallet,
      publicKey,
      []
    )

    const userInstruction = createCloseAccountInstruction(
      tokenAccount,
      publicKey,
      publicKey,
      []
    )

    transaction.add(feeInstruction).add(userInstruction)

    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = publicKey

    // Improved simulation error handling
    try {
      const simulation = await connection.simulateTransaction(transaction)
      
      if (simulation.value.err) {
        const errorLogs = simulation.value.logs?.join('\n') || 'No error logs available'
        logger.error('Transaction simulation failed:', {
          error: simulation.value.err,
          logs: errorLogs
        })
        throw new Error(`Transaction simulation failed: ${errorLogs}`)
      }
    } catch (simError) {
      throw new Error(`Simulation error: ${simError instanceof Error ? simError.message : 'Unknown simulation error'}`)
    }

    const signature = await sendTransaction(transaction, connection)
    await confirmTransaction(connection, signature)

    logger.info(`Token account closed successfully`, {
      signature,
      tokenAccount: tokenAccount.toString()
    })

    return { signature }

  } catch (error) {
    logger.error('Error closing token account:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tokenAccount: tokenAccount.toString()
    })
    return {
      signature: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
} 