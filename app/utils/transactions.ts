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
    // Calculate the fee amount (5% of RENT_EXEMPTION)
    const RENT_EXEMPTION = 0.00203928
    const feeAmount = RENT_EXEMPTION * feePercentage
    const userAmount = RENT_EXEMPTION - feeAmount

    // Create two instructions: one for fee, one for user
    const feeInstruction = createCloseAccountInstruction(
      tokenAccount,
      treasuryWallet, // Fee goes to treasury
      publicKey, // Original owner still needs to sign
      []
    )

    const userInstruction = createCloseAccountInstruction(
      tokenAccount,
      publicKey, // Remaining amount goes to user
      publicKey,
      []
    )
    
    const transaction = new Transaction()
      .add(feeInstruction)
      .add(userInstruction)

    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = publicKey
    
    // Simulate the transaction first
    const simulation = await connection.simulateTransaction(transaction)
    if (simulation.value.err) {
      throw new Error(`Transaction simulation failed: ${simulation.value.err}`)
    }
    
    const signature = await sendTransaction(transaction, connection)
    await confirmTransaction(connection, signature)
    
    logger.info(`Token account closed successfully`, {
      signature,
      tokenAccount: tokenAccount.toString()
    })
    
    return { signature }
    
  } catch (error) {
    logger.error('Error closing token account:', error)
    return {
      signature: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
} 