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

  try {
    // Get account info and safely parse data
    const accountInfo = await connection.getParsedAccountInfo(tokenAccountPubkey);
    if (!accountInfo.value?.data || !('parsed' in accountInfo.value.data)) {
      throw new Error('Invalid account data');
    }

    const parsedData = accountInfo.value.data as ParsedAccountData;
    if (!parsedData.parsed?.info) {
      throw new Error('Missing account info');
    }

    const info = parsedData.parsed.info;
    const balance = info.tokenAmount?.uiAmount || 0;
    const mintAddress = new PublicKey(info.mint);

    // If there's a balance, add burn instruction
    if (balance > 0) {
      const rawBalance = info.tokenAmount.amount;
      const burnInstruction = createBurnInstruction(
        tokenAccountPubkey,
        mintAddress,
        wallet,
        BigInt(rawBalance)
      );
      transaction.add(burnInstruction);
    }

    // Add memo instruction
    const memoInstruction = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(`solanare.claims:close:${isHolder ? 'holder' : 'user'}:${new Date().toISOString()}`)
    });
    transaction.add(memoInstruction);

    // Add close instruction
    const closeInstruction = createCloseAccountInstruction(
      tokenAccountPubkey,
      wallet,
      wallet,
      [],
      TOKEN_PROGRAM_ID
    );
    transaction.add(closeInstruction);

    // Add fee transfer instruction
    const feePercentage = isHolder ? TOKEN_HOLDER_FEE_PERCENTAGE : PLATFORM_FEE_PERCENTAGE;
    const feeAmount = Math.floor(RENT_EXEMPTION * feePercentage * 1e9);
    
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: wallet,
      toPubkey: TREASURY_WALLET,
      lamports: feeAmount
    });
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
  } catch (error: unknown) {
    console.error('Error closing account:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to close account: ${errorMessage}`);
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

export async function batchCloseTokenAccounts(
  connection: Connection,
  wallet: PublicKey,
  tokenAccounts: (PublicKey | string)[],
  sendTransaction: (transaction: Transaction, connection: Connection) => Promise<string>,
  isHolder: boolean = false,
  batchSize: number = 10
) {
  const signatures: string[] = [];
  const batches = [];

  // Split accounts into batches of batchSize
  for (let i = 0; i < tokenAccounts.length; i += batchSize) {
    batches.push(tokenAccounts.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const { blockhash } = await connection.getLatestBlockhash();
    const transaction = new Transaction();

    for (const account of batch) {
      const tokenAccountPubkey = typeof account === 'string' ? new PublicKey(account) : account;
      
      // Get account info and add instructions for each account
      const accountInfo = await connection.getParsedAccountInfo(tokenAccountPubkey);
      if (!accountInfo.value?.data || !('parsed' in accountInfo.value.data)) {
        continue;
      }

      const parsedData = accountInfo.value.data as ParsedAccountData;
      if (!parsedData.parsed?.info) {
        continue;
      }

      const info = parsedData.parsed.info;
      const balance = info.tokenAmount?.uiAmount || 0;
      const mintAddress = new PublicKey(info.mint);

      if (balance > 0) {
        transaction.add(
          createBurnInstruction(
            tokenAccountPubkey,
            mintAddress,
            wallet,
            BigInt(info.tokenAmount.amount)
          )
        );
      }

      // Add close instruction
      transaction.add(
        createCloseAccountInstruction(
          tokenAccountPubkey,
          wallet,
          wallet,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // Add fee transfer
      const feePercentage = isHolder ? TOKEN_HOLDER_FEE_PERCENTAGE : PLATFORM_FEE_PERCENTAGE;
      const feeAmount = Math.floor(RENT_EXEMPTION * feePercentage * 1e9);
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: wallet,
          toPubkey: TREASURY_WALLET,
          lamports: feeAmount
        })
      );
    }

    // Add memo for the batch
    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(`solanare.claims:batch:${isHolder ? 'holder' : 'user'}:${new Date().toISOString()}`)
      })
    );

    transaction.feePayer = wallet;
    transaction.recentBlockhash = blockhash;

    const signature = await sendTransaction(transaction, connection);
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight: (await connection.getLatestBlockhash()).lastValidBlockHeight
    });

    signatures.push(signature);
  }

  return signatures;
}