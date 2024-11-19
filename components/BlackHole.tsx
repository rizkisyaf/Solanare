import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface BlackHoleProps {
  scanning: boolean
  results: {
    totalAccounts: number
    potentialSOL: number
    riskLevel: 'low' | 'medium' | 'high'
  } | null
  isWalletConnected: boolean
}

export function BlackHole({ scanning, results, isWalletConnected }: BlackHoleProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null // Return null on server-side
  }

  if (!isWalletConnected) {
    return (
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
    )
  }

  return (
    <div className="relative w-64 h-64 mx-auto mb-12">
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden shadow-[0_0_100px_20px_rgba(147,51,234,0.3)]"
        animate={{
          scale: scanning ? [1, 1.2, 1] : 1,
          rotate: scanning ? 360 : 0,
        }}
        transition={{
          scale: { repeat: Infinity, duration: 2 },
          rotate: { repeat: Infinity, duration: 8, ease: "linear" }
        }}
      >
        {/* Black Hole Core with Spiral Effect */}
        <div className="absolute inset-0">
          {/* Base black hole */}
          <div className="absolute inset-0 bg-black rounded-full" />

          {/* Spiral gradient layers */}
          <div className="absolute inset-0 rounded-full bg-gradient-conic from-purple-900/5 via-transparent to-transparent"
            style={{ transform: 'scale(0.9) rotate(45deg)' }} />
          <div className="absolute inset-0 rounded-full bg-gradient-conic from-purple-800/10 via-transparent to-transparent"
            style={{ transform: 'scale(0.7) rotate(-60deg)' }} />
          <div className="absolute inset-0 rounded-full bg-gradient-conic from-purple-700/15 via-transparent to-transparent"
            style={{ transform: 'scale(0.5) rotate(30deg)' }} />

          {/* Center vortex effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-radial from-transparent via-purple-900/20 to-black" />
        </div>

        {/* Purple Fire Effect */}
        <div className="absolute inset-[-25%] bg-gradient-conic from-purple-600/40 via-purple-800/60 to-purple-600/40 animate-spin-slow">
          <motion.div
            className="absolute inset-0 backdrop-blur-sm"
            animate={{
              opacity: scanning ? [0.6, 1, 0.6] : 0.4,
              scale: scanning ? [1, 1.2, 1] : 1,
            }}
            transition={{
              repeat: Infinity,
              duration: scanning ? 1 : 1.5,
              ease: "easeInOut"
            }}
          />
        </div>

        {/* Outer Glow */}
        <div className="absolute inset-[-2px] bg-gradient-radial from-purple-500/20 to-transparent animate-pulse" />

        {/* Results Display */}
        <AnimatePresence>
          {results && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center backdrop-blur-sm"
            >
              <div className="text-center text-purple-300">
                <div className="text-2xl font-bold">{results.totalAccounts}</div>
                <div className="text-sm opacity-70">Accounts Found</div>
                <div className="text-lg mt-2">{results.potentialSOL.toFixed(4)} SOL</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
} 