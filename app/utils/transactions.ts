import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js"
import { createCloseAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { TREASURY_WALLET, PLATFORM_FEE_PERCENTAGE } from "./constants"

export async function closeTokenAccount(
  connection: Connection,
  wallet: PublicKey,
  tokenAccount: PublicKey,
  sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>,
  _isHolder?: boolean
) {
  const { blockhash } = await connection.getLatestBlockhash();
  
  const closeInstruction = createCloseAccountInstruction(
    tokenAccount,
    TREASURY_WALLET,
    wallet,
    [],
    TOKEN_PROGRAM_ID
  );

  const transaction = new Transaction()
    .add(closeInstruction);
  
  transaction.feePayer = wallet;
  transaction.recentBlockhash = blockhash;

  const signature = await sendTransaction(transaction, connection);
  
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
  });

  return signature;
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