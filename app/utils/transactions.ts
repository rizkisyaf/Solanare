import { Connection, PublicKey, Transaction, ComputeBudgetProgram, TransactionMessage, VersionedTransaction, SystemProgram } from "@solana/web3.js"
import { createCloseAccountInstruction, createBurnInstruction } from "@solana/spl-token"
import { logger } from "./logger"
import { getPriorityFee } from "./rpc"
import bs58 from 'bs58'

interface TransactionResult {
  signature: string
  error?: string
}

const TRANSACTION_TIMEOUT = 60000; // 60 seconds
const CONFIRMATION_INTERVAL = 5000; // 5 seconds

// Add treasury constants
const TREASURY_WALLET = new PublicKey("8QAUgSFQxMcuYCn3yDN28HuqBsbXq2Ac1rADo5AWh8S5")
const PLATFORM_FEE_PERCENTAGE = 0.05 // 5%
const RENT_EXEMPTION = 0.00203928
const FEE_AMOUNT = RENT_EXEMPTION * PLATFORM_FEE_PERCENTAGE

async function pollTransactionConfirmation(connection: Connection, signature: string): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < TRANSACTION_TIMEOUT) {
    const status = await connection.getSignatureStatus(signature);
    if (status?.value?.confirmationStatus === 'confirmed') return true;
    await new Promise(resolve => setTimeout(resolve, CONFIRMATION_INTERVAL));
  }
  
  return false;
}

export async function closeTokenAccount(
  connection: Connection,
  publicKey: PublicKey,
  tokenAccount: PublicKey,
  sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>
): Promise<TransactionResult> {
  try {
    // Build initial instructions
    const instructions = [];
    
    // Add platform fee transfer instruction
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: TREASURY_WALLET,
        lamports: Math.floor(FEE_AMOUNT * 1e9) // Convert SOL to lamports
      })
    );

    // Add burn instruction if needed
    const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
    if (!accountInfo.value) throw new Error('Account not found');
    
    const parsedInfo = (accountInfo.value.data as any).parsed.info;
    if (parsedInfo.tokenAmount.amount > 0) {
      instructions.push(
        createBurnInstruction(
          tokenAccount,
          new PublicKey(parsedInfo.mint),
          publicKey,
          parsedInfo.tokenAmount.amount,
          []
        )
      );
    }

    // Add close instruction
    instructions.push(
      createCloseAccountInstruction(
        tokenAccount,
        publicKey,
        publicKey,
        []
      )
    );

    // Get latest blockhash and build transaction
    const { blockhash } = await connection.getLatestBlockhash('processed');
    const messageV0 = new TransactionMessage({
      payerKey: publicKey,
      recentBlockhash: blockhash,
      instructions
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Simulate to get compute units
    const simulation = await connection.simulateTransaction(transaction);
    const computeUnits = Math.ceil((simulation.value.unitsConsumed || 200000) * 1.1);

    // Add compute budget instructions
    instructions.unshift(
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits })
    );

    // Get and set priority fee
    const priorityFee = await getPriorityFee(bs58.encode(transaction.serialize()));
    instructions.unshift(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
    );

    // Rebuild final transaction
    const finalMessage = new TransactionMessage({
      payerKey: publicKey,
      recentBlockhash: blockhash,
      instructions
    }).compileToV0Message();

    const finalTransaction = new VersionedTransaction(finalMessage);

    // Send and confirm
    const signature = await sendTransaction(finalTransaction as any, connection);
    const confirmed = await pollTransactionConfirmation(connection, signature);

    if (!confirmed) {
      throw new Error('Transaction confirmation timeout');
    }

    return { signature };

  } catch (error) {
    logger.error('Error closing token account:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tokenAccount: tokenAccount.toString()
    });
    return {
      signature: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
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