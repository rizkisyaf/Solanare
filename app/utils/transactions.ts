import { Connection, PublicKey, Transaction, SystemProgram, ParsedAccountData, TransactionInstruction } from "@solana/web3.js"
import { createBurnInstruction, createCloseAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { TREASURY_WALLET, PLATFORM_FEE_PERCENTAGE, TOKEN_HOLDER_FEE_PERCENTAGE, RENT_EXEMPTION } from "./constants"

// Add Memo Program ID
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export async function closeTokenAccount(
  connection: Connection,
  wallet: PublicKey,
  tokenAccount: PublicKey | string,
  sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>,
  isHolder: boolean = false
) {
  const tokenAccountPubkey = typeof tokenAccount === 'string' ? new PublicKey(tokenAccount) : tokenAccount;
  const { blockhash } = await connection.getLatestBlockhash();
  
  const transaction = new Transaction();
  
  // Get account info and parse token balance
  const accountInfo = await connection.getParsedAccountInfo(tokenAccountPubkey);
  const parsedInfo = (accountInfo.value?.data as ParsedAccountData).parsed.info;
  const balance = parsedInfo?.tokenAmount?.uiAmount || 0;
  const mintAddress = new PublicKey(parsedInfo.mint);

  // If there's a balance, add burn instruction
  if (balance > 0) {
    const rawBalance = parsedInfo.tokenAmount.amount;
    const burnInstruction = createBurnInstruction(
      tokenAccountPubkey,
      mintAddress,
      wallet,
      BigInt(rawBalance),
      []
    );
    transaction.add(burnInstruction);
  }

  // Add close instruction
  const closeInstruction = createCloseAccountInstruction(
    tokenAccountPubkey,
    wallet,
    wallet,
    [],
    TOKEN_PROGRAM_ID
  );
  
  // Add fee transfer instruction
  const feePercentage = isHolder ? TOKEN_HOLDER_FEE_PERCENTAGE : PLATFORM_FEE_PERCENTAGE;
  const feeAmount = Math.floor(RENT_EXEMPTION * feePercentage * 1e9); // Convert to lamports
  
  const transferInstruction = SystemProgram.transfer({
    fromPubkey: wallet,
    toPubkey: TREASURY_WALLET,
    lamports: feeAmount
  });

  // Add memo instruction to mark Solanare operation
  const memoInstruction = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(`solanare.claims:close:${isHolder ? 'holder' : 'user'}:${new Date().toISOString()}`)
  });

  transaction.add(memoInstruction);
  transaction.add(closeInstruction);
  transaction.add(transferInstruction);
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