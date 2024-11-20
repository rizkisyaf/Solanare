import { Connection, PublicKey, AccountInfo as SolanaAccountInfo } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getMint } from "@solana/spl-token"
import { logger } from "./logger"
import { withFallback } from "./rpc"
import { createCloseAccountMessage } from "./transactions"

interface AccountInfo {
  pubkey: PublicKey
  mint?: string
  balance: number
  isAssociated: boolean
  type: 'token' | 'openOrder' | 'undeployed' | 'unknown'
  programId: PublicKey
  rentExemption?: number
  isFrozen?: boolean
  isMintable?: boolean
  hasFreezingAuthority?: boolean
  estimatedCloseCost?: number
  isCloseable: boolean
  closeWarning?: string
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
  SERUM_V3: new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
  OPENBOOK_V3: new PublicKey('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX'),
  MANGO_V3: new PublicKey('mv3ekLzLbnVPNxjSKvqBpU3ZeZXPQdEC3bp5MDEBG68'),
  RAYDIUM_V4: new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8')
}

const RENT_EXEMPTION = 0.00203928

async function scanTokenAccounts(connection: Connection, publicKey: PublicKey): Promise<AccountInfo[]> {
  const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })

  return Promise.all(
    accounts.value.map(async account => {
      const parsedInfo = account.account.data.parsed.info
      const mint = new PublicKey(parsedInfo.mint)

      // Get mint info to check authorities
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
          logger.error('Error estimating close cost:', error)
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
        isCloseable = false
        closeWarning = 'Cannot close: Account has token balance'
      } else if (mintInfo.freezeAuthority) {
        isCloseable = false
        closeWarning = 'Cannot close: Token is freezable'
      } else if (mintInfo.mintAuthority) {
        isCloseable = false
        closeWarning = 'Cannot close: Token is mintable'
      } else if (!canPayForClose) {
        isCloseable = false
        closeWarning = 'Cannot close: Insufficient SOL for transaction fee'
      }

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
        isMintable: !!mintInfo.mintAuthority,
        hasFreezingAuthority: !!mintInfo.freezeAuthority,
        estimatedCloseCost: await estimatedCloseCost(connection),
        isCloseable,
        closeWarning
      }
    })
  )
}

async function scanOpenOrders(connection: Connection, publicKey: PublicKey): Promise<AccountInfo[]> {
  const allAccounts = await Promise.all(
    Object.entries(KNOWN_PROGRAMS).map(async ([name, programId]) => {
      const programAccounts = await connection.getProgramAccounts(programId, {
        filters: [
          { dataSize: 3228 },
          { memcmp: { offset: 13, bytes: publicKey.toBase58() } }
        ]
      })

      return programAccounts.map(account => ({
        pubkey: account.pubkey,
        balance: 0,
        isAssociated: false,
        type: 'openOrder' as const,
        programId,
        rentExemption: RENT_EXEMPTION,
        isCloseable: true,
        closeWarning: ''
      }))
    })
  )

  return allAccounts.flat()
}

async function scanUndeployedTokens(connection: Connection, publicKey: PublicKey): Promise<AccountInfo[]> {
  const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      { dataSize: 165 },
      { memcmp: { offset: 32, bytes: publicKey.toBase58() } }
    ]
  })

  return accounts.map(account => ({
    pubkey: account.pubkey,
    balance: 0,
    isAssociated: false,
    type: 'undeployed' as const,
    programId: TOKEN_PROGRAM_ID,
    rentExemption: RENT_EXEMPTION,
    isCloseable: true,
    closeWarning: ''
  }))
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
        balance: accountInfo.lamports / 1e9,
        isAssociated: false,
        type: 'unknown' as const,
        programId: accountInfo.owner,
        rentExemption: RENT_EXEMPTION,
        isCloseable: true,
        closeWarning: ''
      })
    }

    return unknownAccounts
  } catch (error) {
    logger.error('Error scanning unknown accounts:', error)
    return []
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
  logger.info('Starting comprehensive account scan', { publicKey: publicKey.toString() })

  const scannedAccounts = {
    tokenAccounts: await withFallback(
      (conn) => scanTokenAccounts(conn, publicKey),
      connection
    ),
    openOrders: await withFallback(
      (conn) => scanOpenOrders(conn, publicKey),
      connection
    ),
    undeployedTokens: await withFallback(
      (conn) => scanUndeployedTokens(conn, publicKey),
      connection
    ),
    unknownAccounts: await withFallback(
      (conn) => scanUnknownAccounts(conn, publicKey),
      connection
    )
  }

  const results: ScanResults = {
    ...scannedAccounts,
    potentialSOL: calculatePotentialSOL({ ...scannedAccounts, potentialSOL: 0, riskLevel: 'low' }),
    riskLevel: assessRiskLevel({ ...scannedAccounts, potentialSOL: 0, riskLevel: 'low' })
  }

  logger.info('Scan complete', {
    tokenAccounts: results.tokenAccounts.length,
    openOrders: results.openOrders.length,
    undeployedTokens: results.undeployedTokens.length,
    unknownAccounts: results.unknownAccounts.length,
    potentialSOL: results.potentialSOL,
    riskLevel: results.riskLevel
  })

  return results
} 