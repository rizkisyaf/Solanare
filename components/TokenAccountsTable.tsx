import { RENT_AFTER_FEE } from "@/app/utils/constants"
import { PublicKey } from "@solana/web3.js"
import Image from 'next/image'

interface BaseAccount {
  pubkey: PublicKey;
  mint: string;
  balance: number;
  isCloseable: boolean;
  closeWarning?: string;
  tokenInfo?: {
    name: string;
    symbol: string;
    usdValue?: number;
  };
}

interface TokenAccountsTableProps {
  accounts: BaseAccount[];
  onClose: (pubkey: PublicKey) => void;
  isClosing: boolean;
  userSolBalance: number;
}

export function TokenAccountsTable({ accounts, onClose, isClosing, userSolBalance }: TokenAccountsTableProps) {
  const hasEnoughSol = userSolBalance >= 0.01;
  const totalReclaimableSol = accounts.filter(a => a.isCloseable).length * RENT_AFTER_FEE;

  return (
    <div className="w-full overflow-x-auto px-2 md:px-4">
      <div className="flex items-center gap-2 mb-4 p-3 md:p-4 bg-green-500/10 border border-green-500/20">
        <div className="w-2 md:w-3 h-2 md:h-3 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm md:text-base text-purple-300">Potentially you&apos;ll reclaim</span>
        <span className="text-sm md:text-base text-green-400 font-semibold ml-2">
          (+{totalReclaimableSol.toFixed(4)} SOL)
        </span>
      </div>
      {!hasEnoughSol && (
        <div className="mb-4 p-3 md:p-4 bg-red-500/20 text-red-300 text-sm md:text-base rounded-lg">
          Warning: You need at least 0.01 SOL in your wallet for transaction fees
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-purple-300">
          <thead>
            <tr className="border-b border-purple-500/20">
              <th className="p-2 md:p-4 text-sm md:text-base">Token</th>
              <th className="p-2 md:p-4 text-sm md:text-base">Balance</th>
              <th className="p-2 md:p-4 text-sm md:text-base">Value</th>
              <th className="p-2 md:p-4 text-sm md:text-base">Action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.pubkey.toBase58()} className="border-b border-purple-500/10">
                <td className="p-2 md:p-4">
                  <div className="flex items-center gap-2 md:gap-3">
                    <div>
                      <p className="text-sm md:text-base font-medium">
                        {account.mint === 'So11111111111111111111111111111111111111112' ? 'SOL' :
                         account.mint === 'So11111111111111111111111111111111111111113' ? 'WSOL' :
                         account.tokenInfo?.symbol || 'Unknown'}
                      </p>
                      <p className="text-xs md:text-sm text-purple-300/50">
                        {account.mint === 'So11111111111111111111111111111111111111112' ? 'Solana' :
                         account.mint === 'So11111111111111111111111111111111111111113' ? 'Wrapped SOL' :
                         account.tokenInfo?.name || 'Unknown Token'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-2 md:p-4 text-sm md:text-base">{account.balance}</td>
                <td className="p-2 md:p-4 text-sm md:text-base">
                  {account.tokenInfo?.usdValue ? 
                    `$${(account.balance * account.tokenInfo.usdValue).toFixed(2)}` : 
                    '-'
                  }
                </td>
                <td className="p-2 md:p-4">
                  <button
                    onClick={() => onClose(account.pubkey)}
                    disabled={isClosing || !hasEnoughSol}
                    className="text-sm md:text-base px-3 py-1.5 md:px-4 md:py-2 bg-purple-500/20 rounded-lg hover:bg-purple-500/30 disabled:opacity-50"
                  >
                    Claim
                  </button>
                  {account.closeWarning && (
                    <p className="text-xs md:text-sm text-yellow-300 mt-1">{account.closeWarning}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 