import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js"
import { createCloseAccountInstruction, createBurnInstruction } from "@solana/spl-token"
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
    const transaction = new Transaction()
    
    // Get account info to check balance
    const accountInfo = await connection.getParsedAccountInfo(tokenAccount)
    if (!accountInfo.value) throw new Error('Account not found')
    
    const parsedInfo = (accountInfo.value.data as any).parsed.info
    const mint = new PublicKey(parsedInfo.mint)
    const balance = parsedInfo.tokenAmount.amount

    // If balance > 0, add burn instruction before closing
    if (balance > 0) {
      const burnInstruction = createBurnInstruction(
        tokenAccount,
        mint,
        publicKey,
        balance,
        []
      )
      transaction.add(burnInstruction)
    }

    // Only add one close instruction - we can't close the same account twice
    const closeInstruction = createCloseAccountInstruction(
      tokenAccount,
      publicKey, // Send rent back to the user
      publicKey,
      []
    )

    transaction.add(closeInstruction)

    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = publicKey

    // Send and confirm transaction
    try {
      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, 'confirmed')
      return { signature }
    } catch (error) {
      throw new Error(`Failed to send transaction: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
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