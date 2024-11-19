'use client'

import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { PublicKey, Transaction } from "@solana/web3.js"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { closeTokenAccount } from "./utils/transactions"
import { logger } from "./utils/logger"

require('@solana/wallet-adapter-react-ui/styles.css')

interface TokenAccount {
  pubkey: PublicKey
  mint: string
  balance: number
}

export default function Component() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const [accounts, setAccounts] = useState<TokenAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const { toast } = useToast()

  // Star field animation
  useEffect(() => {
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
  }, [])

  const scanAccounts = async () => {
    if (!publicKey) return

    setLoading(true)
    try {
      logger.info('Starting account scan', { publicKey: publicKey.toString() })
      
      const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID })
      const zeroBalanceAccounts = accounts.value
        .filter(account => {
          const parsedInfo = account.account.data.parsed.info
          return parsedInfo.tokenAmount.uiAmount === 0
        })
        .map(account => ({
          pubkey: account.pubkey,
          mint: account.account.data.parsed.info.mint,
          balance: account.account.data.parsed.info.tokenAmount.uiAmount
        }))

      logger.info('Scan complete', { 
        totalAccounts: accounts.value.length,
        zeroBalanceAccounts: zeroBalanceAccounts.length 
      })

      setAccounts(zeroBalanceAccounts)
      toast({
        title: "Scan Complete",
        description: `Found ${zeroBalanceAccounts.length} unused token accounts`,
      })
    } catch (error) {
      logger.error("Error scanning accounts:", error)
      toast({
        title: "Error scanning accounts",
        description: "Please try again later",
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
    const RENT_EXEMPTION = 0.00203928

    for (const account of accounts) {
      logger.info('Attempting to close account', { 
        account: account.pubkey.toString() 
      })

      const result = await closeTokenAccount(
        connection,
        publicKey,
        account.pubkey,
        sendTransaction
      )

      if (result.signature && !result.error) {
        closedCount++
        totalRentReclaimed += RENT_EXEMPTION
        logger.info('Account closed successfully', { 
          signature: result.signature,
          account: account.pubkey.toString()
        })
      } else {
        logger.error('Failed to close account', { 
          account: account.pubkey.toString(),
          error: result.error 
        })
        toast({
          title: "Error closing account",
          description: result.error || "Unknown error occurred",
          variant: "destructive",
        })
      }
    }

    setAccounts(prevAccounts =>
      prevAccounts.filter(account =>
        !accounts.some(closedAccount =>
          closedAccount.pubkey.toString() === account.pubkey.toString()
        )
      )
    )

    setClosing(false)

    logger.info('Account closure complete', { 
      closedCount,
      totalRentReclaimed 
    })

    if (closedCount > 0) {
      toast({
        title: "Accounts Closed",
        description: `Closed ${closedCount} accounts and reclaimed approximately ${totalRentReclaimed.toFixed(8)} SOL`,
      })
    }
  }

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
              <div className="text-xl font-bold text-purple-400">Voidara</div>
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
            <div className="relative w-64 h-64 mx-auto mb-16">
              <motion.div
                className="absolute inset-0 rounded-full bg-black shadow-[0_0_100px_20px_rgba(138,43,226,0.5)]"
                animate={{
                  rotate: 360,
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 20,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <div className="absolute inset-2 rounded-full bg-gradient-conic from-purple-900 via-indigo-900 to-purple-900 opacity-50" />
                <div className="absolute inset-0 rounded-full bg-black opacity-80" />
                <div className="absolute inset-0 rounded-full bg-gradient-radial from-transparent to-purple-900/50" />
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-purple-500/30"
                  animate={{
                    rotate: 360,
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              </motion.div>
            </div>

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
                <AnimatePresence>
                  {accounts.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                      {accounts.map((account) => (
                        <Card key={account.pubkey.toString()} className="bg-purple-900/30 border-purple-500/30">
                          <CardContent className="p-4">
                            <p className="text-purple-300 truncate">{account.pubkey.toString()}</p>
                            <p className="text-purple-400">Mint: {account.mint.slice(0, 4)}...{account.mint.slice(-4)}</p>
                            <p className="text-purple-400">Balance: {account.balance}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
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
      </div>
    </div>
  )
}