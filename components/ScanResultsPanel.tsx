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
        className="fixed bottom-0 right-0 z-[99999] w-full md:w-[600px] bg-black/80 backdrop-blur-sm"
        initial={{ y: "100%" }}
        animate={{ y: isOpen ? "0%" : "calc(100% - 48px)" }}
        transition={{ type: "spring", bounce: 0.2 }}
      >
        <div className="flex flex-col max-h-[80vh]">
          <div className="bg-purple-950/95 p-4 border-b border-purple-500/20 cursor-pointer"
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
                <h3 className="text-xl font-semibold text-purple-300">
                  Found {accounts.length} Accounts
                </h3>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseAll();
                }}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-lg"
              >
                Close All Accounts
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