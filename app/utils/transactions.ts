import { Connection, PublicKey, Transaction, SystemProgram, ParsedAccountData } from "@solana/web3.js"
import { createBurnInstruction, createCloseAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { TREASURY_WALLET, PLATFORM_FEE_PERCENTAGE } from "./constants"

export async function closeTokenAccount(
  connection: Connection,
  wallet: PublicKey,
  tokenAccount: PublicKey | string,
  sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>,
  _isHolder?: boolean
) {
  const tokenAccountPubkey = typeof tokenAccount === 'string' ? new PublicKey(tokenAccount) : tokenAccount;
  const { blockhash } = await connection.getLatestBlockhash();
  
  // First burn any remaining tokens
  const accountInfo = await connection.getParsedAccountInfo(tokenAccountPubkey);
  const parsedInfo = (accountInfo.value?.data as ParsedAccountData).parsed.info;
  const balance = parsedInfo?.tokenAmount?.amount || 0;
  
  const transaction = new Transaction();
  
  if (Number(balance) > 0) {
    const burnInstruction = createBurnInstruction(
      tokenAccountPubkey,
      parsedInfo.mint,
      wallet,
      BigInt(balance),
      []
    );
    transaction.add(burnInstruction);
  }

  // Then close the account
  const closeInstruction = createCloseAccountInstruction(
    tokenAccountPubkey,
    wallet,
    wallet,
    [],
    TOKEN_PROGRAM_ID
  );
  
  transaction.add(closeInstruction);
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