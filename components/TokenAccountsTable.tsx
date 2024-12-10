import { PublicKey } from "@solana/web3.js"
import Image from 'next/image'

interface TokenAccountsTableProps {
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
}

export function TokenAccountsTable({ accounts, onClose, isClosing, userSolBalance }: TokenAccountsTableProps) {
  const hasEnoughSol = userSolBalance >= 0.01;

  return (
    <div className="w-full overflow-x-auto">
      {!hasEnoughSol && (
        <div className="mb-4 p-4 bg-red-500/20 text-red-300 rounded-lg">
          Warning: You need at least 0.01 SOL in your wallet for transaction fees
        </div>
      )}
      
      <table className="w-full text-left text-purple-300">
        <thead>
          <tr className="border-b border-purple-500/20">
            <th className="p-4">Token</th>
            <th className="p-4">Balance</th>
            <th className="p-4">Value</th>
            <th className="p-4">Action</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.pubkey.toString()} className="border-b border-purple-500/10">
              <td className="p-4">
                <div className="flex items-center gap-3">
                  {account.tokenInfo?.logoURI ? (
                    <Image 
                      src={account.tokenInfo.logoURI}
                      alt={account.tokenInfo.symbol || 'token'}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 bg-purple-500/20 rounded-full" />
                  )}
                  <div>
                    <p className="font-medium">{account.tokenInfo?.symbol || 'Unknown'}</p>
                    <p className="text-xs text-purple-300/50">{account.tokenInfo?.name || 'Unknown Token'}</p>
                  </div>
                </div>
              </td>
              <td className="p-4">{account.balance}</td>
              <td className="p-4">
                {account.tokenInfo?.usdValue ? 
                  `$${(account.balance * account.tokenInfo.usdValue).toFixed(2)}` : 
                  '-'
                }
              </td>
              <td className="p-4">
                <button
                  onClick={() => onClose(account.pubkey)}
                  disabled={isClosing || !hasEnoughSol}
                  className="px-4 py-2 bg-purple-500/20 rounded-lg hover:bg-purple-500/30 disabled:opacity-50"
                >
                  Close Account
                </button>
                {account.closeWarning && (
                  <p className="text-xs text-yellow-300 mt-1">{account.closeWarning}</p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 