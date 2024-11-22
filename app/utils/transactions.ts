import { Connection, PublicKey, Transaction, ComputeBudgetProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js"
import { createCloseAccountInstruction } from "@solana/spl-token"
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
    // Get latest blockhash with "processed" commitment
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('processed')
    
    // Create base instruction
    const closeInstruction = createCloseAccountInstruction(
      tokenAccount,
      wallet,
      wallet
    )

    // Create test transaction to simulate compute units
    const testTx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
      closeInstruction
    )
    testTx.feePayer = wallet
    testTx.recentBlockhash = blockhash

    // Simulate to get compute units consumed
    const simulation = await connection.simulateTransaction(testTx)
    const unitsConsumed = Math.ceil((simulation.value?.unitsConsumed || 0) * 1.1) // Add 10% margin

    // Get priority fee estimate
    const serializedTx = bs58.encode(testTx.serialize())
    const priorityFee = await getPriorityFee(serializedTx)

    // Build final transaction with optimized compute units and priority fee
    const transaction = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: unitsConsumed }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
      closeInstruction
    )

    transaction.feePayer = wallet
    transaction.recentBlockhash = blockhash

    // Send transaction with skipPreflight
    const signature = await sendTransaction(transaction, connection)
    
    // Poll for confirmation with timeout
    const startTime = Date.now()
    while (Date.now() - startTime < TRANSACTION_TIMEOUT) {
      const status = await connection.getSignatureStatus(signature)
      if (status?.value?.confirmationStatus === 'confirmed') {
        return { signature }
      }
      await new Promise(resolve => setTimeout(resolve, CONFIRMATION_INTERVAL))
    }

    throw new Error('Transaction confirmation timeout')

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