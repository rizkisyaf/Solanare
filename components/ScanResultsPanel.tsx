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
        initial={{ y: "100%" }}
        animate={{ y: isOpen ? 0 : "calc(100% - 40px)" }}
        className="fixed inset-0 top-0 z-[1000] pointer-events-none"
      >
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        <div
          className="absolute bottom-[40px] left-0 right-0 bg-purple-950/95 border-t border-purple-500/20 pointer-events-auto"
          style={{
            maxHeight: "calc(100vh - 120px)",
            minHeight: "300px",
            zIndex: 1001
          }}
        >
          <button
            onClick={onToggle}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full bg-purple-950/95 px-6 py-2 rounded-b-lg border-b border-l border-r border-purple-500/20 hover:bg-purple-900/95 transition-colors pointer-events-auto"
          >
            <div className="flex items-center gap-2">
              <span className="text-purple-300/80 hover:text-purple-300">Scan Results</span>
              <motion.span
                animate={{ rotate: isOpen ? 0 : 180 }}
                className="text-purple-300/80"
              >
                ▼
              </motion.span>
            </div>
          </button>

          <div className="overflow-y-auto p-4 space-y-4 h-full">
            <div className="flex justify-between items-center sticky top-0 bg-purple-950/95 py-2 z-10">
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