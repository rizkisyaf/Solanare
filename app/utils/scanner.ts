import { Connection, PublicKey, AccountInfo as SolanaAccountInfo } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getMint } from "@solana/spl-token"
import { logger } from "./logger"
import { withFallback } from "./rpc"
import { createCloseAccountMessage } from "./transactions"
import { rateLimit } from "./rateLimit"

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

async function scanTokenAccounts(connection: Connection, publicKey: PublicKey): Promise<AccountInfo[]> {
  return rateLimit(async () => {
    try {
      const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })
      
      const results = await Promise.allSettled(
        accounts.value.map(async account => {
          try {
            if (!account?.account?.data?.parsed?.info) {
              logger.warn('Invalid account data structure', { account })
              return null
            }
            
            const parsedInfo = account.account.data.parsed.info
            const mint = new PublicKey(parsedInfo.mint)
            const mintInfo = await getMint(connection, mint)

            // Calculate estimated closing cost
            const rentExemption = RENT_EXEMPTION
            const estimatedCloseCost = async (connection: Connection) => {
              try {
                // Get latest blockhash first
                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

                // Create transaction and set recent blockhash
                const transaction = await createCloseAccountMessage(connection, publicKey, account.pubkey)
                transaction.recentBlockhash = blockhash
                transaction.feePayer = publicKey

                // Now we can safely compile and get fee
                const message = transaction.compileMessage()
                const response = await connection.getFeeForMessage(message)
                return response.value || 5000 // fallback to default if null
              } catch (error) {
                logger.error('Error estimating close cost', {
                  error,
                  details: {
                    account: account.pubkey.toString(),
                    publicKey: publicKey.toString()
                  }
                });
                return 5000 // fallback to default on error
              }
            }
            // Check if account has enough SOL to pay for closing
            const closeEstimate = await estimatedCloseCost(connection)
            const userBalance = await connection.getBalance(publicKey)
            const canPayForClose = userBalance >= closeEstimate

            // Determine closeability and warning message
            let isCloseable = true
            let closeWarning = ''

            if (parsedInfo.tokenAmount.amount > 0) {
              // Check if token is worth keeping
              const isWorthless = await isTokenWorthless(connection, mint)
              if (!isWorthless) {
                closeWarning = 'Warning: Account has non-zero balance'
              }
            } else if (!canPayForClose) {
              isCloseable = false
              closeWarning = 'Cannot close: Insufficient SOL for transaction fee'
            } else if (parsedInfo.state === 'frozen') {
              isCloseable = false
              closeWarning = 'Cannot close: Account is frozen'
            }

            // Add warning tags but don't prevent closing
            const hasFreezingAuthority = !!mintInfo.freezeAuthority
            const isMintable = !!mintInfo.mintAuthority

            const ata = await getAssociatedTokenAddress(
              mint,
              publicKey,
              false,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
            return {
              pubkey: account.pubkey,
              mint: parsedInfo.mint,
              balance: parsedInfo.tokenAmount.uiAmount,
              isAssociated: account.pubkey.equals(ata),
              type: 'token' as const,
              programId: TOKEN_PROGRAM_ID,
              rentExemption: RENT_EXEMPTION,
              isFrozen: parsedInfo.state === 'frozen',
              isMintable: isMintable,
              hasFreezingAuthority: hasFreezingAuthority,
              estimatedCloseCost: await estimatedCloseCost(connection),
              isCloseable,
              closeWarning
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            logger.error('Error scanning token accounts', {
              error: {
                message: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
              },
              details: {
                publicKey: publicKey.toString(),
                operation: 'scanTokenAccounts',
                programId: TOKEN_PROGRAM_ID.toString()
              }
            });
            return [];
          }
        })
      )
      return results
        .filter((result): result is PromiseFulfilledResult<{
          pubkey: PublicKey;
          mint: any;
          balance: any;
          isAssociated: boolean;
          type: "token";
          programId: PublicKey;
          rentExemption: number;
          isFrozen: boolean;
          isMintable: boolean;
          hasFreezingAuthority: boolean;
          estimatedCloseCost: number;
          isCloseable: boolean;
          closeWarning: string;
        }> => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value)
    } catch (error) {
      logger.error('Error scanning token accounts', {
        error,
        details: {
          publicKey: publicKey.toString(),
          operation: 'scanTokenAccounts'
        }
      });
      return []
    }
  });
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