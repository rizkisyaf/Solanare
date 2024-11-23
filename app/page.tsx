'use client'

import dynamic from 'next/dynamic'
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { PublicKey, Transaction } from "@solana/web3.js"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { logger } from "./utils/logger"
import '@solana/wallet-adapter-react-ui/styles.css'
import { BlackHole } from '@/components/BlackHole'
import { scanAllAccounts } from './utils/scanner'
import { checkTransactionSecurity, SecurityCheck } from './utils/security'
import { SecurityStatus } from "@/components/SecurityStatus"
import Image from 'next/image'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination"
import { BalanceFilter } from './types/accounts'
import { BalanceFilter as BalanceFilterComponent } from '@/components/BalanceFilter'
import { getConnection } from './utils/rpc'
import { closeTokenAccount } from './utils/transactions'

interface TokenAccount {
  pubkey: PublicKey
  mint: string
  balance: number
  isAssociated: boolean
  type: 'token' | 'openOrder' | 'undeployed' | 'unknown'
  programId: PublicKey
  rentExemption: number  // Make this required
  isCloseable: boolean
  closeWarning: string  // Make this required
  isMintable?: boolean  // Optional
  hasFreezingAuthority?: boolean  // Optional
  isFrozen?: boolean  // Optional
}

// Treasury wallet for collecting platform fees
const PLATFORM_FEE_PERCENTAGE = 0.05 // 5%
const RENT_EXEMPTION = 0.00203928
const RENT_AFTER_FEE = RENT_EXEMPTION * (1 - PLATFORM_FEE_PERCENTAGE)

// Move WalletMultiButton import here
const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
)

// Add these constants at the top with other constants
const ITEMS_PER_PAGE = 10 // Reduced from 15 for better UX
const DEFAULT_FILTER: BalanceFilter = {
  min: 0,
  max: 0,
  includeNonZero: false,
  includeFreezable: false,
  includeMintable: false,
  filterType: 'all'
}

export default function Component() {
  // Group all useState hooks together
  const [mounted, setMounted] = useState(false)
  const [accounts, setAccounts] = useState<TokenAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [securityCheck, setSecurityCheck] = useState<SecurityCheck | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(1)
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>(DEFAULT_FILTER)

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

      const scanResults = await scanAllAccounts(getConnection(), publicKey)

      if (scanResults) {
        const securityCheck = await checkTransactionSecurity(
          connection,
          publicKey,
          { accounts: scanResults }
        )

        setSecurityCheck(securityCheck)

        if (securityCheck.isScam) {
          throw new Error(`Security Risk Detected: ${securityCheck.details}`)
        }

        const allAccounts = [
          ...scanResults.tokenAccounts,
          ...scanResults.openOrders,
          ...scanResults.undeployedTokens,
          ...scanResults.unknownAccounts
        ].map(account => ({
          pubkey: account.pubkey,
          mint: account.mint || 'unknown',
          balance: account.balance,
          isAssociated: account.isAssociated,
          type: account.type,
          programId: account.programId,
          rentExemption: account.rentExemption || RENT_EXEMPTION,
          isCloseable: account.isCloseable,
          closeWarning: account.closeWarning || '',  // Provide default empty string
          isMintable: account.isMintable || false,
          hasFreezingAuthority: account.hasFreezingAuthority || false,
          isFrozen: account.isFrozen || false
        })) as TokenAccount[]

        setAccounts(allAccounts)
        toast({
          title: "Scan Complete",
          description: `Found ${allAccounts.length} accounts with ${scanResults.potentialSOL.toFixed(8)} SOL potential reclaim`,
        })
      }

    } catch (error) {
      logger.error('Error scanning accounts', {
        error,
        details: {
          walletAddress: publicKey?.toString(),
          operation: 'scanAccounts'
        }
      });
      toast({
        title: "Error scanning accounts",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false)
    }
  }

  const closeAccounts = async () => {
    if (!publicKey || !sendTransaction || accounts.length === 0) {
      toast({
        title: "Error",
        description: "Wallet not connected or no accounts to close",
        variant: "destructive",
      });
      return;
    }

    setClosing(true);
    let closedCount = 0;
    let failedCount = 0;
    let totalRentReclaimed = 0;

    try {
      const closeableAccounts = accounts.filter(account => account.isCloseable);
      
      for (const account of closeableAccounts) {
        try {
          logger.info('Attempting to close account', {
            account: account.pubkey.toString()
          });

          const result = await closeTokenAccount(
            connection,
            publicKey,
            account.pubkey,
            sendTransaction
          );

          if (result.error) {
            failedCount++;
            toast({
              title: "Failed to Close Account",
              description: result.error,
              variant: "destructive",
            });
            continue;
          }

          closedCount++;
          totalRentReclaimed += RENT_AFTER_FEE;
          
          // Remove closed account from state
          setAccounts(prev => prev.filter(a => !a.pubkey.equals(account.pubkey)));
          
          toast({
            title: "Account Closed",
            description: `Successfully closed account ${account.pubkey.toString().slice(0, 4)}...${account.pubkey.toString().slice(-4)}`,
          });

          // Add delay between transactions
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          failedCount++;
          logger.error('Error closing account:', {
            error: error instanceof Error ? error.message : 'Unknown error',
            tokenAccount: account.pubkey.toString()
          });
        }
      }
    } finally {
      setClosing(false);
      logger.info('Account closure complete', {
        closedCount,
        failedCount,
        totalRentReclaimed
      });
    }
  };

  // Add this after the useState hooks
  const filteredAccounts = accounts.filter(account => {
    if (balanceFilter.filterType === 'zero-only') return account.balance === 0
    if (balanceFilter.filterType === 'non-zero-only') return account.balance > 0
    if (balanceFilter.filterType === 'custom') {
      return account.balance <= balanceFilter.max!
    }
    return true
  }).filter(account => {
    if (!balanceFilter.includeFreezable && account.hasFreezingAuthority) return false
    if (!balanceFilter.includeMintable && account.isMintable) return false
    return true
  })

  // Add pagination calculation
  const getPaginatedAccounts = (accounts: TokenAccount[]) => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return accounts.slice(startIndex, endIndex)
  }

  // Add total pages calculation
  const getTotalPages = (totalItems: number) => {
    return Math.ceil(totalItems / ITEMS_PER_PAGE)
  }

  const totalPages = getTotalPages(filteredAccounts.length)
  const paginatedAccounts = getPaginatedAccounts(filteredAccounts)

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
              <div className="flex items-center gap-2">
                <Image
                  src="/voidora-logo.svg"
                  alt="Voidora Logo"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
                <div className="text-xl font-bold text-purple-400">Solanare.claims</div>
              </div>
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

        <main className="container mx-auto px-4 pt-20 pb-32 text-center">
          <div className="min-h-screen flex flex-col justify-center">
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
            </motion.div>

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

            {/* Add Token Info Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-12 p-4 bg-purple-900/20 border border-purple-500/20 rounded-lg max-w-xl mx-auto"
            >
              <div className="text-center space-y-3">
                <h3 className="text-xl font-semibold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                  $SOLANARE Token
                </h3>
                <div className="flex items-center justify-center gap-2">
                  <code className="bg-black/30 px-3 py-1 rounded-lg text-purple-300 font-mono text-sm">
                    14ornfnSSU2Gr23hhru7mAUpUM68H4rx13B2YMWb6ume
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-purple-400 hover:text-purple-300"
                    onClick={() => {
                      navigator.clipboard.writeText("14ornfnSSU2Gr23hhru7mAUpUM68H4rx13B2YMWb6ume")
                      toast({
                        title: "Address Copied",
                        description: "Token address copied to clipboard",
                      })
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </Button>
                </div>
                <p className="text-sm text-purple-300/70">
                  Now available on Moonshot 🚀
                </p>
              </div>
            </motion.div>

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

                {/* Add BalanceFilter component here */}
                {accounts.length > 0 && (
                  <BalanceFilterComponent onFilterChange={setBalanceFilter} />
                )}

                {accounts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto bg-black/30 p-4 rounded-lg border border-purple-500/20">
                      <div>
                        <p className="text-purple-300">Closeable Accounts</p>
                        <p className="text-2xl text-purple-400">
                          {accounts.filter(a => a.isCloseable).length}
                        </p>
                        <p className="text-sm text-purple-300/70">
                          {(accounts.filter(a => a.isCloseable).length * RENT_AFTER_FEE).toFixed(4)} SOL
                        </p>
                      </div>
                      <div>
                        <p className="text-purple-300">Non-Closeable</p>
                        <p className="text-2xl text-purple-400">
                          {accounts.filter(a => !a.isCloseable).length}
                        </p>
                        <p className="text-sm text-purple-300/70">
                          {(accounts.filter(a => !a.isCloseable).length * RENT_EXEMPTION).toFixed(4)} SOL
                        </p>
                      </div>
                      <div>
                        <p className="text-purple-300">Account Types</p>
                        <div className="text-sm text-purple-300/70 space-y-1">
                          <p>Token: {accounts.filter(a => a.type === 'token').length}</p>
                          <p>Orders: {accounts.filter(a => a.type === 'openOrder').length}</p>
                          <p>Undeployed: {accounts.filter(a => a.type === 'undeployed').length}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-purple-300">Total SOL</p>
                        <p className="text-2xl text-green-400">
                          {(accounts.filter(a => a.isCloseable).length * RENT_AFTER_FEE).toFixed(4)}
                        </p>
                        <p className="text-sm text-red-400/70">
                          +{(accounts.filter(a => !a.isCloseable).length * RENT_EXEMPTION).toFixed(4)} locked
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
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20"
                    >
                      {paginatedAccounts.map((account) => (
                        <Card
                          key={account.pubkey.toString()}
                          className="relative overflow-hidden bg-black/30 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                        >
                          <CardContent className="p-6">
                            {/* Header with Type and Rent */}
                            <div className="flex justify-between items-start mb-4">
                              <span className={`text-xs font-medium px-3 py-1 rounded-full ${account.type === 'token' ? 'bg-purple-500/20 text-purple-300' :
                                  account.type === 'openOrder' ? 'bg-blue-500/20 text-blue-300' :
                                    account.type === 'undeployed' ? 'bg-green-500/20 text-green-300' :
                                      'bg-red-500/20 text-red-300'
                                }`}>
                                {account.type}
                              </span>
                              <div className="text-right">
                                <span className="text-sm text-purple-300/70">Rent</span>
                                <p className="text-sm font-medium text-purple-300">{RENT_AFTER_FEE.toFixed(8)} SOL</p>
                              </div>
                            </div>

                            {/* Status Tags */}
                            {(account.isMintable || account.hasFreezingAuthority || account.isFrozen || !account.isCloseable) && (
                              <div className="flex flex-wrap gap-2 mb-4">
                                {account.isMintable && (
                                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300">
                                    Mintable
                                  </span>
                                )}
                                {account.hasFreezingAuthority && (
                                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">
                                    Freezable
                                  </span>
                                )}
                                {account.isFrozen && (
                                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-red-500/20 text-red-300">
                                    Frozen
                                  </span>
                                )}
                                {!account.isCloseable && (
                                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-red-500/20 text-red-300"
                                    title={account.closeWarning}>
                                    Not Closeable
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Account Details */}
                            <div className="space-y-2">
                              <p className="text-purple-300 text-sm truncate font-mono bg-purple-500/10 px-3 py-2 rounded">
                                {account.pubkey.toString()}
                              </p>
                              <div className="flex justify-between items-center">
                                <p className="text-purple-400 text-sm">
                                  Mint: {account.mint.slice(0, 4)}...{account.mint.slice(-4)}
                                </p>
                                <span className={`text-xs font-medium px-3 py-1 rounded-full ${account.isAssociated ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
                                  }`}>
                                  {account.isAssociated ? 'Associated' : 'Non-Associated'}
                                </span>
                              </div>
                            </div>

                            {/* Balance Footer */}
                            <div className="mt-4 pt-4 border-t border-purple-500/20">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-purple-300/70">Balance</span>
                                <span className="text-sm font-medium text-purple-300">{account.balance}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Update pagination visibility condition */}
                {filteredAccounts.length > ITEMS_PER_PAGE && (
                  <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-sm p-4">
                    <div className="container mx-auto">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                setCurrentPage(p => Math.max(1, p - 1))
                              }}
                              className={currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}
                            />
                          </PaginationItem>
                          {Array.from({ length: totalPages }, (_, i) => (
                            <PaginationItem key={i}>
                              <PaginationLink
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault()
                                  setCurrentPage(i + 1)
                                }}
                                isActive={currentPage === i + 1}
                              >
                                {i + 1}
                              </PaginationLink>
                            </PaginationItem>
                          ))}
                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                setCurrentPage(p => Math.min(totalPages, p + 1))
                              }}
                              className={currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
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
          </div>
        </main>

        {/* Add footer */}
        <footer className="py-6 border-t border-purple-500/20">
          <div className="container mx-auto px-4 text-center text-purple-300/50 text-sm">
            <p>© 2024 Solanare. All rights reserved.</p>
            <p className="mt-2">Built with ❤️ for the Solana community</p>
            <div className="mt-2 space-y-1">
              <p>
                <a 
                  href="mailto:support@solana.reclaims" 
                  className="hover:text-purple-300 transition-colors"
                >
                  support@solana.reclaims
                </a>
              </p>
              <p>
                <a 
                  href="https://twitter.com/kisra_fistya" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-purple-300 transition-colors flex items-center justify-center gap-1"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  @kisra_fistya
                </a>
              </p>
            </div>
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