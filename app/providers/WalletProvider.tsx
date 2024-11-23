'use client'

import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter, AlphaWalletAdapter } from '@solana/wallet-adapter-wallets'
import { useMemo } from 'react'
import '@solana/wallet-adapter-react-ui/styles.css'
import { getConnection } from '../utils/rpc'

export function ClientWalletProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const network = WalletAdapterNetwork.Mainnet
  const connection = getConnection('confirmed')

  const wallets = useMemo(() => [
    new PhantomWalletAdapter({ network }),
    new SolflareWalletAdapter({ network }),
    new AlphaWalletAdapter({ network })
  ], [network])

  return (
    <ConnectionProvider endpoint={connection.rpcEndpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
} 