import { motion, AnimatePresence } from "framer-motion"
import { TokenAccountsTable } from "./TokenAccountsTable"
import { PublicKey } from "@solana/web3.js"

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
      logoURI?: string
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
  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 flex flex-col max-h-screen">
          <div className="sticky top-0 z-50 bg-purple-950/95 p-4 border-b border-purple-500/20">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-purple-300">
                Found {accounts.length} Accounts
              </h3>
              <button
                onClick={onCloseAll}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-lg"
              >
                Close All Accounts
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TokenAccountsTable
              accounts={accounts}
              onClose={onClose}
              isClosing={isClosing}
              userSolBalance={userSolBalance}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
} 