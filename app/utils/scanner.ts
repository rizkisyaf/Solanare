import { Connection, PublicKey, AccountInfo as SolanaAccountInfo, Transaction, Commitment, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getMint } from "@solana/spl-token"
import { logger } from "./logger"
import { withFallback } from "./rpc"
import { rateLimit } from "./rateLimit"
import { createCloseAccountMessage } from "./transactions"
import { MIN_VIABLE_RECLAIM, PLATFORM_FEE_PERCENTAGE, RENT_AFTER_FEE } from "./constants"

interface AccountInfo {
  pubkey: PublicKey
  mint: string  // Remove optional
  balance: number
  isAssociated: boolean
  type: 'token' | 'openOrder' | 'undeployed' | 'unknown'
  programId: PublicKey
  rentExemption: number  // Remove optional
  isFrozen: boolean  // Remove optional
  isMintable: boolean  // Remove optional
  hasFreezingAuthority: boolean  // Remove optional
  estimatedCloseCost: number  // Remove optional
  isCloseable: boolean
  closeWarning: string  // Remove optional
}

interface ScanResults {
  tokenAccounts: AccountInfo[]
  openOrders: AccountInfo[]
  undeployedTokens: AccountInfo[]
  unknownAccounts: AccountInfo[]
  potentialSOL: number
  riskLevel: 'low' | 'medium' | 'high'
}

const KNOWN_PROGRAMS = {
  OPENBOOK_V3: new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX'),
  MANGO_V3: new PublicKey('mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68'),
  RAYDIUM_V4: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')
}

const RENT_EXEMPTION = 0.00203928

// Constants for retry logic
const MAX_RETRIES = 3
const RETRY_DELAY = 1000
const COMMITMENT: Commitment = 'processed'

async function withRetry<T>(
  operation: () => Promise<T>,
  program: string
): Promise<T> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await operation()
    } catch (error) {
      if (i === MAX_RETRIES - 1) throw error

      logger.warn(`Failed to scan program ${program}, will retry`, {
        error,
        details: { program }
      })

      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
    }
  }
  throw new Error('Max retries exceeded')
}

async function scanTokenAccounts(connection: Connection, publicKey: PublicKey): Promise<AccountInfo[]> {
  return rateLimit(async () => {
    try {
      const accounts = await withRetry(
        () => connection.getParsedTokenAccountsByOwner(
          publicKey,
          { programId: TOKEN_PROGRAM_ID },
          COMMITMENT
        ),
        'TOKEN_PROGRAM'
      )

      const results = await Promise.allSettled(
        accounts.value.map(async account => {
          try {
            if (!account?.account?.data?.parsed?.info) {
              logger.warn('Invalid account data structure', { account })
              return null
            }

            const parsedInfo = account.account.data.parsed.info
            const mint = new PublicKey(parsedInfo.mint)

            try {
              const mintInfo = await getMint(connection, mint)
              const closeEstimate = await estimatedCloseCost(connection, publicKey, account.pubkey)
              const userBalance = await connection.getBalance(publicKey, 'processed')

              // Calculate total cost and potential reclaim
              const platformFee = Math.floor(RENT_EXEMPTION * PLATFORM_FEE_PERCENTAGE * LAMPORTS_PER_SOL)
              const totalCost = closeEstimate + platformFee
              const potentialReclaim = RENT_AFTER_FEE

              // Check if reclaim amount is worth it
              const isWorthReclaiming = potentialReclaim >= MIN_VIABLE_RECLAIM

              // User can close if their current balance can cover costs and reclaim is worth it
              const canPayForClose = userBalance >= closeEstimate
              const isCloseable = canPayForClose && parsedInfo.tokenAmount.amount === '0' && isWorthReclaiming
              const closeWarning = !isWorthReclaiming 
                ? `Reclaim amount (${potentialReclaim.toFixed(4)} SOL) is below minimum viable amount (${MIN_VIABLE_RECLAIM} SOL)`
                : ''

              return {
                pubkey: account.pubkey,
                mint: parsedInfo.mint,
                balance: parsedInfo.tokenAmount.uiAmount || 0,
                isAssociated: false,
                type: 'token',
                programId: TOKEN_PROGRAM_ID,
                rentExemption: RENT_EXEMPTION,
                isFrozen: parsedInfo.state === 'frozen',
                isMintable: !!mintInfo.mintAuthority,
                hasFreezingAuthority: !!mintInfo.freezeAuthority,
                estimatedCloseCost: closeEstimate,
                isCloseable,
                closeWarning
              }
            } catch (error) {
              logger.error('Error processing token account', { error, account: account.pubkey.toString() })
              return null
            }
          } catch (error) {
            logger.error('Error scanning token account', { error, account })
            return null
          }
        })
      )

      return results
        .filter((result): result is PromiseFulfilledResult<AccountInfo | null> =>
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value as AccountInfo)

    } catch (error) {
      logger.error('Error scanning token accounts', { error })
      return []
    }
  })
}

async function estimatedCloseCost(
  connection: Connection,
  wallet: PublicKey,
  accountToClose: PublicKey
): Promise<number> {
  try {
    const { blockhash } = await connection.getLatestBlockhash('processed')
    const transaction = await createCloseAccountMessage(connection, wallet, accountToClose)
    transaction.recentBlockhash = blockhash
    transaction.feePayer = wallet

    const message = transaction.compileMessage()
    const response = await connection.getFeeForMessage(message, 'processed')
    // Only return network fee, not including platform fee since it comes from reclaimed rent
    return response.value || 5000
  } catch (error) {
    logger.warn('Error estimating close cost', { error })
    return 5000 // Default fallback
  }
}

async function scanOpenOrders(connection: Connection, publicKey: PublicKey): Promise<AccountInfo[]> {
  try {
    // Batch requests to avoid rate limits
    const batchSize = 2;
    const results: AccountInfo[] = [];

    for (let i = 0; i < Object.entries(KNOWN_PROGRAMS).length; i += batchSize) {
      const batch = Object.entries(KNOWN_PROGRAMS).slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async ([name, programId]) => {
          try {
            const programAccounts = await connection.getProgramAccounts(programId, {
              filters: [
                { dataSize: 3228 },
                { memcmp: { offset: 13, bytes: publicKey.toBase58() } }
              ],
              commitment: 'confirmed'
            });

            return programAccounts.map(account => ({
              pubkey: account.pubkey,
              mint: 'unknown',
              balance: 0,
              isAssociated: false,
              type: 'openOrder' as const,
              programId,
              rentExemption: RENT_EXEMPTION,
              isCloseable: true,
              closeWarning: '',
              isFrozen: false,
              isMintable: false,
              hasFreezingAuthority: false,
              estimatedCloseCost: 5000
            }));
          } catch (error) {
            logger.warn(`Failed to scan program ${name}, will retry`, {
              error,
              details: { program: programId.toString() }
            });
            throw error;
          }
        })
      );

      // Add successful results
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        }
      });

      // Add delay between batches
      if (i + batchSize < Object.entries(KNOWN_PROGRAMS).length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return results;
  } catch (error) {
    logger.error('Error scanning open orders', { error });
    return [];
  }
}

async function scanUndeployedTokens(connection: Connection, publicKey: PublicKey): Promise<AccountInfo[]> {
  return [{
    pubkey: publicKey,
    mint: 'unknown',
    balance: 0,
    isAssociated: false,
    type: 'undeployed' as const,
    programId: TOKEN_PROGRAM_ID,
    rentExemption: RENT_EXEMPTION,
    isCloseable: true,
    closeWarning: '',
    isFrozen: false,
    isMintable: false,
    hasFreezingAuthority: false,
    estimatedCloseCost: 5000
  }]
}

async function scanUnknownAccounts(connection: Connection, publicKey: PublicKey): Promise<AccountInfo[]> {
  try {
    const accountInfo = await connection.getAccountInfo(publicKey)
    if (!accountInfo) return []

    const knownProgramIds = Object.values(KNOWN_PROGRAMS)
    const unknownAccounts: AccountInfo[] = []

    if (!knownProgramIds.some(id => id.equals(accountInfo.owner))) {
      unknownAccounts.push({
        pubkey: publicKey,
        mint: 'unknown',
        balance: accountInfo.lamports / 1e9,
        isAssociated: false,
        type: 'unknown' as const,
        programId: accountInfo.owner,
        rentExemption: RENT_EXEMPTION,
        isCloseable: true,
        closeWarning: '',
        isFrozen: false,
        isMintable: false,
        hasFreezingAuthority: false,
        estimatedCloseCost: 5000
      })
    }

    return unknownAccounts
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error scanning unknown accounts', {
      error: {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      },
      details: {
        publicKey: publicKey.toString(),
        operation: 'scanUnknownAccounts'
      }
    });
    return [];
  }
}

function calculatePotentialSOL(accounts: ScanResults): number {
  const allAccounts = [
    ...accounts.tokenAccounts,
    ...accounts.openOrders,
    ...accounts.undeployedTokens,
    ...accounts.unknownAccounts
  ]

  return allAccounts.reduce((total, account) => {
    return total + (account.rentExemption || RENT_EXEMPTION)
  }, 0)
}

function assessRiskLevel(accounts: ScanResults): 'low' | 'medium' | 'high' {
  const unknownCount = accounts.unknownAccounts.length
  const totalCount = Object.values(accounts)
    .reduce((total, accounts) => {
      return Array.isArray(accounts) ? total + accounts.length : total
    }, 0)

  if (unknownCount === 0) return 'low'
  if (unknownCount / totalCount < 0.3) return 'medium'
  return 'high'
}

async function isTokenWorthless(connection: Connection, mint: PublicKey): Promise<boolean> {
  try {
    const [liquidityCheck, activityCheck] = await Promise.allSettled([
      // Check DEX liquidity
      Promise.any(
        Object.values(KNOWN_PROGRAMS).map(async dex => {
          const pools = await connection.getProgramAccounts(dex, {
            filters: [{ memcmp: { offset: 9, bytes: mint.toBase58() } }]
          })
          return pools.length > 0
        })
      ),
      // Check recent activity
      connection.getSignaturesForAddress(mint, { limit: 10 })
    ])

    // If either check fails, assume token is not worthless for safety
    if (liquidityCheck.status === 'rejected' || activityCheck.status === 'rejected') {
      return false
    }

    const hasLiquidity = liquidityCheck.value
    const hasActivity = activityCheck.value.length > 0

    return !hasLiquidity && !hasActivity

  } catch (error) {
    logger.warn('Error checking token worth', {
      error,
      details: {
        mint: mint.toString(),
        operation: 'isTokenWorthless'
      }
    });
    return false // Default to false for safety
  }
}

export async function scanAllAccounts(connection: Connection, publicKey: PublicKey): Promise<ScanResults> {
  logger.info('Starting comprehensive account scan', { publicKey: publicKey.toString() });
  const headers = {
    'X-Account-Index': '2.0',
    'Content-Type': 'application/json'
  };
  try {
    const scannedAccounts = {
      tokenAccounts: await withFallback(
        (conn) => scanTokenAccounts(conn, publicKey),
        connection,
        headers
      ),
      openOrders: await withFallback(
        (conn) => scanOpenOrders(conn, publicKey),
        connection,
        headers
      ),
      undeployedTokens: await withFallback(
        (conn) => scanUndeployedTokens(conn, publicKey),
        connection,
        headers
      ),
      unknownAccounts: await withFallback(
        (conn) => scanUnknownAccounts(conn, publicKey),
        connection,
        headers
      )
    };
    return {
      ...scannedAccounts,
      potentialSOL: calculatePotentialSOL({ ...scannedAccounts, potentialSOL: 0, riskLevel: 'low' }),
      riskLevel: assessRiskLevel({ ...scannedAccounts, potentialSOL: 0, riskLevel: 'low' })
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Error in scanAllAccounts', {
      error: {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      },
      details: {
        publicKey: publicKey.toString(),
        operation: 'scanAllAccounts'
      }
    });
    throw error;
  }
}