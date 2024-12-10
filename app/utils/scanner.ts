import { Connection, PublicKey } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { logger } from "./logger"
import { getTokenMetadata, withFallback } from "./rpc"
import { RENT_EXEMPTION } from "./constants"

interface BaseAccount {
  pubkey: PublicKey
  mint: string
  balance: number
  isCloseable: boolean
  closeWarning?: string
  rentExemption?: number
  type: 'token' | 'openOrder' | 'undeployed' | 'unknown'
  programId: PublicKey
  isAssociated?: boolean
  isMintable?: boolean
  hasFreezingAuthority?: boolean
  isFrozen?: boolean
  tokenInfo?: {
    name: string
    symbol: string
    logoURI?: string
    usdValue?: number
  }
}

interface TokenAccount extends BaseAccount {
  type: 'token'
}

interface OpenOrderAccount extends BaseAccount {
  type: 'openOrder'
}

interface UndeployedAccount extends BaseAccount {
  type: 'undeployed'
}

interface UnknownAccount extends BaseAccount {
  type: 'unknown'
}


interface ScanResults {
  tokenAccounts: TokenAccount[]
  openOrders: OpenOrderAccount[]
  undeployedTokens: UndeployedAccount[]
  unknownAccounts: UnknownAccount[]
  potentialSOL: number
  riskLevel: 'low' | 'medium' | 'high'
}

const KNOWN_PROGRAMS = {
  OPENBOOK_V3: new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX'),
  MANGO_V3: new PublicKey('mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68'),
  RAYDIUM_V4: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')
}

export async function scanTokenAccounts(connection: Connection, publicKey: PublicKey): Promise<TokenAccount[]> {
  try {
    const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: TOKEN_PROGRAM_ID
    });

    const tokenAccountsPromises = accounts.value.map(async account => {
      const parsedInfo = account.account.data.parsed.info;
      const metadata = await getTokenMetadata(connection, parsedInfo.mint);

      return {
        pubkey: account.pubkey,
        mint: parsedInfo.mint,
        balance: parsedInfo.tokenAmount.uiAmount || 0,
        type: 'token' as const,
        programId: TOKEN_PROGRAM_ID,
        isCloseable: true,
        closeWarning: parsedInfo.tokenAmount.uiAmount > 0 ?
          'Remaining token balance will be burned' : undefined,
        isAssociated: true,
        isMintable: false,
        hasFreezingAuthority: false,
        isFrozen: false,
        tokenInfo: metadata ? {
          name: metadata.name,
          symbol: metadata.symbol,
          logoURI: metadata.logoURI,
          usdValue: metadata.usdValue
        } : undefined
      };
    });

    const tokenAccounts = await Promise.all(tokenAccountsPromises);
    return tokenAccounts;

  } catch (error) {
    logger.error('Error scanning token accounts', { error });
    return [];
  }
}


async function scanOpenOrders(connection: Connection, publicKey: PublicKey): Promise<OpenOrderAccount[]> {
  try {
    // Batch requests to avoid rate limits
    const batchSize = 2;
    const results: OpenOrderAccount[] = [];

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
              type: 'openOrder' as const,
              programId,
              isCloseable: true,
              closeWarning: ''
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

async function scanUndeployedTokens(connection: Connection, publicKey: PublicKey): Promise<UndeployedAccount[]> {
  return [{
    pubkey: publicKey,
    mint: 'unknown',
    balance: 0,
    type: 'undeployed' as const,
    programId: TOKEN_PROGRAM_ID,
    isCloseable: true,
    closeWarning: ''
  }]
}

async function scanUnknownAccounts(connection: Connection, publicKey: PublicKey): Promise<UnknownAccount[]> {
  try {
    const accountInfo = await connection.getAccountInfo(publicKey)
    if (!accountInfo) return []

    const knownProgramIds = Object.values(KNOWN_PROGRAMS)
    const unknownAccounts: UnknownAccount[] = []

    if (!knownProgramIds.some(id => id.equals(accountInfo.owner))) {
      unknownAccounts.push({
        pubkey: publicKey,
        mint: 'unknown',
        balance: accountInfo.lamports / 1e9,
        type: 'unknown' as const,
        programId: accountInfo.owner,
        isCloseable: true,
        closeWarning: ''
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