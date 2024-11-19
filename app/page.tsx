'use client'

import dynamic from 'next/dynamic'
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { PublicKey } from "@solana/web3.js"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { closeTokenAccount } from "./utils/transactions"
import { logger } from "./utils/logger"
import '@solana/wallet-adapter-react-ui/styles.css'
import { BlackHole } from '@/components/BlackHole'
import { scanAllAccounts } from './utils/scanner'
import { checkTransactionSecurity, SecurityCheck } from './utils/security'
import { SecurityStatus } from "@/components/SecurityStatus"
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious
} from "@/components/ui/pagination"

interface TokenAccount {
  pubkey: PublicKey
  mint: string
  balance: number
  isAssociated: boolean
  type: 'token' | 'openOrder' | 'undeployed' | 'unknown'
  programId: PublicKey
  rentExemption?: number
}

// Treasury wallet for collecting platform fees
const TREASURY_WALLET = new PublicKey("8QAUgSFQxMcuYCn3yDN28HuqBsbXq2Ac1rADo5AWh8S5")
const PLATFORM_FEE_PERCENTAGE = 0.05 // 5%
const RENT_EXEMPTION = 0.00203928
const RENT_AFTER_FEE = RENT_EXEMPTION * (1 - PLATFORM_FEE_PERCENTAGE)

// Move WalletMultiButton import here
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
)

export default function Component() {
  // Group all useState hooks together
  const [mounted, setMounted] = useState(false)
  const [accounts, setAccounts] = useState<TokenAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [securityCheck, setSecurityCheck] = useState<SecurityCheck | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  // Group all refs and context hooks
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const { toast } = useToast()

  // Mounting effect
  useEffect(() => {
    setMounted(true)
  }, [])

  // Star field animation effect
  useEffect(() => {
    if (!mounted) return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    const stars: Array<{ x: number, y: number, size: number, speed: number }> = []

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initStars()
    }

    const initStars = () => {
      stars.length = 0
      const numberOfStars = Math.floor((canvas.width * canvas.height) / 4000)

      for (let i = 0; i < numberOfStars; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2,
          speed: Math.random() * 0.5 + 0.1
        })
      }
    }

    const drawStars = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      stars.forEach(star => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fill()

        star.y = (star.y + star.speed) % canvas.height
      })

      animationFrameId = requestAnimationFrame(drawStars)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    drawStars()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', resizeCanvas)
    }
  }, [mounted])

  if (!mounted) {
    return null
  }

  const scanAccounts = async () => {
    if (!publicKey) return

    setLoading(true)
    setSecurityCheck(undefined)

    try {
      logger.info('Starting account scan', { publicKey: publicKey.toString() })

      const scanResults = await scanAllAccounts(connection, publicKey)

      const securityCheck = await checkTransactionSecurity(
        connection,
        publicKey,
        { accounts: scanResults }
      )

      setSecurityCheck(securityCheck)

      if (securityCheck.isScam) {
        throw new Error(`Security Risk Detected: ${securityCheck.details}`)
      }

      // Convert and filter accounts to match TokenAccount interface
      const allAccounts = [
        ...scanResults.tokenAccounts,
        ...scanResults.openOrders,
        ...scanResults.undeployedTokens,
        ...scanResults.unknownAccounts
      ].map(account => ({
        pubkey: account.pubkey,
        mint: account.mint || 'unknown',  // Provide default for optional mint
        balance: account.balance,
        isAssociated: account.isAssociated,
        type: account.type,
        programId: account.programId,
        rentExemption: account.rentExemption
      })) as TokenAccount[]

      setAccounts(allAccounts)
      toast({
        title: "Scan Complete",
        description: `Found ${allAccounts.length} accounts with ${scanResults.potentialSOL.toFixed(8)} SOL potential reclaim`,
      })

    } catch (error) {
      logger.error("Error scanning accounts:", error)
      toast({
        title: "Error scanning accounts",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      })
    }
    setLoading(false)
  }

  const closeAccounts = async () => {
    if (!publicKey || accounts.length === 0) return

    setClosing(true)
    logger.info('Starting account closure', {
      accountCount: accounts.length,
      publicKey: publicKey.toString()
    })

    let closedCount = 0
    let totalRentReclaimed = 0
    let failedAccounts: string[] = []

    for (const account of accounts) {
      logger.info('Attempting to close account', {
        account: account.pubkey.toString()
      })

      const result = await closeTokenAccount(
        connection,
        publicKey,
        account.pubkey,
        TREASURY_WALLET,
        PLATFORM_FEE_PERCENTAGE,
        sendTransaction
      )

      if (result.signature && !result.error) {
        closedCount++
        totalRentReclaimed += RENT_AFTER_FEE
        logger.info('Account closed successfully', {
          signature: result.signature,
          account: account.pubkey.toString()
        })
      } else {
        failedAccounts.push(account.pubkey.toString())
        logger.error('Failed to close account', {
          account: account.pubkey.toString(),
          error: result.error
        })
        toast({
          title: "Failed to close account",
          description: `Error: ${result.error}`,
          variant: "destructive",
        })
      }
    }

    // Remove only successfully closed accounts
    setAccounts(prevAccounts =>
      prevAccounts.filter(account =>
        !failedAccounts.includes(account.pubkey.toString())
      )
    )

    setClosing(false)

    logger.info('Account closure complete', {
      closedCount,
      failedCount: failedAccounts.length,
      totalRentReclaimed
    })

    if (closedCount > 0) {
      toast({
        title: "Accounts Closed",
        description: `Successfully closed ${closedCount} accounts and reclaimed ${totalRentReclaimed.toFixed(8)} SOL (after 5% platform fee)${
          failedAccounts.length > 0 ? `\n${failedAccounts.length} accounts failed to close.` : ''
        }`,
      })
    }
  }

  // Calculate pagination
  const totalPages = Math.ceil(accounts.length / itemsPerPage)
  const currentAccounts = accounts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at center, #13023E 0%, #000000 100%)' }}
      />

      {/* Cosmic Dust */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(88,28,135,0.15),transparent_80%)] animate-pulse" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-lg border-b border-purple-500/20">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="text-xl font-bold text-purple-400">Voidora</div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <WalletMultiButton className="!bg-gradient-to-r from-purple-500 to-blue-500 !rounded-full" />
              </motion.div>
            </div>
          </div>
        </nav>

        <main className="flex-grow container mx-auto px-4 pt-20 text-center flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Black Hole Animation */}
            <BlackHole
              scanning={loading}
              results={accounts.length > 0 ? {
                totalAccounts: accounts.length,
                potentialSOL: accounts.length * RENT_AFTER_FEE,
                riskLevel: accounts.some(a => !a.isAssociated) ? 'medium' : 'low'
              } : null}
              isWalletConnected={!!publicKey}
            />

            {/* Scam Protection Message */}
            {publicKey && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="w-full flex justify-center items-center mb-8"
              >
                <div className="bg-green-900/30 text-green-400 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  Scam Protection Active
                </div>
              </motion.div>
            )}

            <h1 className="text-7xl font-bold mb-6 leading-tight tracking-tight">
              <span className="block bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 text-transparent bg-clip-text">
                Void. Vanish. Value.
              </span>
            </h1>

            <p className="text-2xl text-purple-300/70 mb-12 max-w-2xl mx-auto">
              Watch your zero-balance accounts disappear into the cosmic void, reclaiming precious SOL
            </p>

            {publicKey ? (
              <div className="space-y-8">
                <div className="flex justify-center gap-4">
                  <Button
                    onClick={scanAccounts}
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-2 px-6 rounded-full hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                  >
                    {loading ? "Scanning..." : "Scan Accounts"}
                  </Button>
                  <div className="text-sm text-purple-300/70 mb-2">
                    A 5% platform fee applies to reclaimed SOL
                  </div>
                  {accounts.length > 0 && (
                    <Button
                      onClick={closeAccounts}
                      disabled={closing}
                      className="bg-gradient-to-r from-red-500 to-purple-500 text-white font-semibold py-2 px-6 rounded-full hover:shadow-lg hover:shadow-red-500/30 transition-all"
                    >
                      {closing ? "Closing..." : `Close ${accounts.length} Accounts`}
                    </Button>
                  )}
                </div>
                {accounts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                  >
                    <div className="grid grid-cols-4 gap-4 max-w-3xl mx-auto bg-black/30 p-4 rounded-lg border border-purple-500/20">
                      <div>
                        <p className="text-purple-300">Token Accounts</p>
                        <p className="text-2xl text-purple-400">
                          {accounts.filter(a => a.type === 'token').length}
                        </p>
                      </div>
                      <div>
                        <p className="text-purple-300">Open Orders</p>
                        <p className="text-2xl text-purple-400">
                          {accounts.filter(a => a.type === 'openOrder').length}
                        </p>
                      </div>
                      <div>
                        <p className="text-purple-300">Undeployed</p>
                        <p className="text-2xl text-purple-400">
                          {accounts.filter(a => a.type === 'undeployed').length}
                        </p>
                      </div>
                      <div>
                        <p className="text-purple-300">Total SOL</p>
                        <p className="text-2xl text-purple-400">
                          {(accounts.length * RENT_AFTER_FEE).toFixed(4)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
                <AnimatePresence>
                  {accounts.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
                    >
                      {currentAccounts.map((account) => (
                        <Card
                          key={account.pubkey.toString()}
                          className={`${account.type === 'token' ? 'bg-purple-900/30 border-purple-500/30' :
                            account.type === 'openOrder' ? 'bg-blue-900/30 border-blue-500/30' :
                              account.type === 'undeployed' ? 'bg-green-900/30 border-green-500/30' :
                                'bg-red-900/30 border-red-500/30'
                            }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${account.type === 'token' ? 'bg-purple-500/20 text-purple-300' :
                                account.type === 'openOrder' ? 'bg-blue-500/20 text-blue-300' :
                                  account.type === 'undeployed' ? 'bg-green-500/20 text-green-300' :
                                    'bg-red-500/20 text-red-300'
                                }`}>
                                {account.type}
                              </span>
                              <span className="text-sm text-purple-300/70">
                                {RENT_AFTER_FEE.toFixed(8)} SOL
                              </span>
                            </div>
                            <p className="text-purple-300 text-sm truncate font-mono">
                              {account.pubkey.toString()}
                            </p>
                            <p className="text-purple-400 text-sm">
                              Mint: {account.mint.slice(0, 4)}...{account.mint.slice(-4)}
                            </p>
                            <div className="mt-2 pt-2 border-t border-purple-500/20 flex justify-between items-center">
                              <span className="text-sm text-purple-300/70">
                                Balance: {account.balance}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${account.isAssociated ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
                                }`}>
                                {account.isAssociated ? 'Associated' : 'Non-Associated'}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Add pagination */}
                {accounts.length > itemsPerPage && (
                  <div className="mt-8 mb-12">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            href="#"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            aria-disabled={currentPage === 1}
                          />
                        </PaginationItem>
                        {[...Array(totalPages)].map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              onClick={() => setCurrentPage(i + 1)}
                              isActive={currentPage === i + 1}
                            >
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            aria-disabled={currentPage === totalPages}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-sm text-purple-300/50 flex items-center justify-center gap-2"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                </span>
                Connect your wallet to begin
              </motion.div>
            )}
          </motion.div>
        </main>

        {/* Add footer */}
        <footer className="py-6 border-t border-purple-500/20">
          <div className="container mx-auto px-4 text-center text-purple-300/50 text-sm">
            <p>© 2024 Voidora. All rights reserved.</p>
            <p className="mt-2">Built with ❤️ for the Solana community</p>
          </div>
        </footer>
      </div>
      
      <SecurityStatus
        isScanning={loading}
        securityCheck={securityCheck}
      />
    </div>
  )
}