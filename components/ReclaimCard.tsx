import { motion } from "framer-motion"
import { Button } from "./ui/button"
import { RENT_AFTER_FEE } from "../app/utils/constants"

interface ReclaimCardProps {
  totalAccounts: number
  totalReclaimed: number
  walletAddress: string
  onShare: () => void
  personalMessage?: string
  isTokenHolder?: boolean
}

export function ReclaimCard({ totalAccounts, totalReclaimed, walletAddress, onShare, personalMessage, isTokenHolder }: ReclaimCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-purple-900/50 to-black/50 p-6 rounded-xl border border-purple-500/20"
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-purple-300">Reclaim Summary</h3>
          <Button
            onClick={onShare}
            variant="ghost"
            size="sm"
            className="text-purple-400 hover:text-purple-300"
          >
            Share 🔥
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-purple-300/70">Total Accounts Closed</p>
            <p className="text-3xl font-bold text-purple-300">{totalAccounts}</p>
          </div>

          <div>
            <p className="text-sm text-purple-300/70">Total SOL Reclaimed</p>
            <p className="text-3xl font-bold text-green-400">+{totalReclaimed.toFixed(4)} SOL</p>
            <p className="text-sm text-purple-300/70">≈ ${(totalReclaimed * 150).toFixed(2)} USD</p>
          </div>

          <div>
            <p className="text-sm text-purple-300/70">Average per Account</p>
            <p className="text-xl font-semibold text-purple-300">{RENT_AFTER_FEE.toFixed(4)} SOL</p>
          </div>

          {personalMessage && (
            <div className="pt-4 border-t border-purple-500/20">
              <p className="text-sm text-purple-300/70 italic">&quot;{personalMessage}&quot;</p>
            </div>
          )}

          <div className="pt-4 border-t border-purple-500/20">
            <p className="text-xs text-purple-300/50 truncate">
              {walletAddress}
            </p>
            <p className="text-xs text-purple-300/50 flex items-center gap-2">
              via solanare.claims
              {isTokenHolder && <span className="text-purple-400">💎</span>}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
} 