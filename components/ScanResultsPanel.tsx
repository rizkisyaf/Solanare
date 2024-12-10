import { motion, AnimatePresence } from "framer-motion"
import { TokenAccountsTable } from "./TokenAccountsTable"
import { PublicKey } from "@solana/web3.js"
import { useState } from "react"
import { Confetti } from "./Confetti"

interface ScanResultsPanelProps {
  isOpen: boolean
  onToggle: () => void
  accounts: {
    pubkey: PublicKey
    mint: string
    balance: number
    isCloseable: boolean
    closeWarning?: string
    tokenInfo?: {
      name: string
      symbol: string
      usdValue?: number
    }
  }[]
  onClose: (pubkey: PublicKey) => void
  isClosing: boolean
  userSolBalance: number
  onCloseAll: () => void
}

export function ScanResultsPanel({
  isOpen,
  onToggle,
  accounts,
  onClose,
  isClosing,
  userSolBalance,
  onCloseAll
}: ScanResultsPanelProps) {
  const [showSmallConfetti, setShowSmallConfetti] = useState(false);

  const handleClaim = async (pubkey: PublicKey) => {
    setShowSmallConfetti(true)
    await onClose(pubkey)
    setTimeout(() => setShowSmallConfetti(false), 3000)
  }

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed bottom-5 right-0 z-[99999] w-full md:w-[600px] lg:w-[700px] bg-black/80 backdrop-blur-sm safe-bottom"
        initial={{ y: "100%" }}
        animate={{ y: isOpen ? "0%" : "calc(100% - 48px)" }}
        transition={{ type: "spring", bounce: 0.2 }}
      >
        {showSmallConfetti && <Confetti isSmall={true} />}
        <div className="flex flex-col max-h-[90vh] md:max-h-[80vh]">
          <div className="bg-purple-950/95 p-3 md:p-4 border-b border-purple-500/20 cursor-pointer"
               onClick={onToggle}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-purple-300"
                  >
                    <path d="m18 15-6-6-6 6"/>
                  </svg>
                </motion.div>
                <h3 className="text-lg md:text-xl font-semibold text-purple-300">
                  Found {accounts.length} Accounts
                </h3>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseAll();
                }}
                className="text-sm md:text-base bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 md:px-4 md:py-2 rounded-lg"
              >
                Claim All
              </button>
            </div>
          </div>

          <motion.div 
            className="flex-1 overflow-y-auto"
            animate={{ height: isOpen ? "auto" : 0 }}
            style={{ display: isOpen ? "block" : "none" }}
          >
            <TokenAccountsTable
              accounts={accounts}
              onClose={onClose}
              isClosing={isClosing}
              userSolBalance={userSolBalance}
            />
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
} 