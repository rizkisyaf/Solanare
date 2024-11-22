'use client'

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { useMemo } from 'react'
import '@solana/wallet-adapter-react-ui/styles.css'
import { RPC_ENDPOINTS } from '../utils/rpc'

export function ClientWalletProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const network = WalletAdapterNetwork.Mainnet
  const endpoint = RPC_ENDPOINTS[0]

  const wallets = useMemo(() => [
    new PhantomWalletAdapter({ network })
  ], [network])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
} 