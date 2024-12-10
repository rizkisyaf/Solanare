import { motion } from "framer-motion"
import { RENT_AFTER_FEE } from "../app/utils/constants"

interface AccountStatsProps {
  accounts: {
    isCloseable: boolean
  }[]
  isTokenHolder: boolean
}

export function AccountStats({ accounts, isTokenHolder }: AccountStatsProps) {
  const closeableAccounts = accounts.filter(a => a.isCloseable).length
  const totalReclaimable = closeableAccounts * RENT_AFTER_FEE
  const platformFee = totalReclaimable * (isTokenHolder ? 0.03 : 0.05) // 3% for holders, 5% for others
  const finalAmount = totalReclaimable - platformFee

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto bg-black/30 p-4 rounded-lg border border-purple-500/20">
        <div>
          <p className="text-purple-300">Total Reclaimable</p>
          <p className="text-2xl text-purple-400">
            {totalReclaimable.toFixed(4)} SOL
          </p>
        </div>
        <div>
          <p className="text-purple-300">Platform Fee ({isTokenHolder ? '3%' : '5%'})</p>
          <p className="text-2xl text-red-400">
            {platformFee.toFixed(4)} SOL
          </p>
        </div>
        <div>
          <p className="text-purple-300">You Receive</p>
          <p className="text-2xl text-green-400">
            {finalAmount.toFixed(4)} SOL
          </p>
        </div>
      </div>
    </motion.div>
  )
} 