'use client'

import dynamic from 'next/dynamic'
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { PublicKey } from "@solana/web3.js"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { logger } from "./utils/logger"
import '@solana/wallet-adapter-react-ui/styles.css'
import { scanAllAccounts } from './utils/scanner'
import { checkTransactionSecurity, SecurityCheck } from './utils/security'
import { SecurityStatus } from "@/components/SecurityStatus"
import Image from 'next/image'
import { closeTokenAccount } from './utils/transactions'
import { useAnalytics } from './hooks/useAnalytics'
import { RENT_AFTER_FEE } from './utils/constants'
import { checkTokenHolder } from './utils/token'
import { StarField } from '@/components/StarField'
import Link from 'next/link'
import { AccountStats } from '@/components/AccountStats'
import { ScanResultsPanel } from '@/components/ScanResultsPanel'
import { Confetti } from '@/components/Confetti'


interface BaseAccount {
  pubkey: PublicKey
  mint: string
  balance: number
  programId: PublicKey
  rentExemption: number
  isCloseable: boolean
  closeWarning: string
  tokenInfo?: {
    name: string
    symbol: string
    usdValue?: number
  }
}

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
)

export default function Component() {
  const [mounted, setMounted] = useState(false)
  const [accounts, setAccounts] = useState<BaseAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [securityCheck, setSecurityCheck] = useState<SecurityCheck | undefined>(undefined)
  const [personalMessage, setPersonalMessage] = useState<string>("");
  const [isCheckingTokenHolder, setIsCheckingTokenHolder] = useState(false)
  const [isTokenHolder, setIsTokenHolder] = useState(false)
  const [messageError, setMessageError] = useState<string>('')
  const [showMessageInput, setShowMessageInput] = useState(false);
  const [userSolBalance, setUserSolBalance] = useState<number>(0);
  const [showScanResults, setShowScanResults] = useState(false);
  const [showBigConfetti, setShowBigConfetti] = useState(false)
  const { publicKey, sendTransaction } = useWallet()
  const { connection } = useConnection()
  const { toast } = useToast()
  const { trackEvent } = useAnalytics()
  const handleMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const message = e.target.value
    if (message.length > 100) {
      setMessageError('Message must be less than 100 characters')
      return
    }
    setMessageError('')
    setPersonalMessage(message)
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const checkHolder = async () => {
      if (!publicKey || !connection) return;
      setIsCheckingTokenHolder(true);
      try {
        const isHolder = await checkTokenHolder(publicKey);
        setIsTokenHolder(isHolder);
      } catch (error) {
        logger.error('Failed to check token holder status:', error);
      } finally {
        setIsCheckingTokenHolder(false);
      }
    };

    checkHolder();
  }, [publicKey, connection]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (publicKey && connection) {
        try {
          const balance = await connection.getBalance(publicKey);
          setUserSolBalance(balance / 1e9); // Convert lamports to SOL
        } catch (err) {
          logger.error('Error fetching SOL balance', { error: err });
        }
      }
    };

    fetchBalance();
    // Refresh balance periodically
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  useEffect(() => {
    if (accounts.length > 0) {
      setShowScanResults(true);
    }
  }, [accounts]);

  if (!mounted) {
    return null
  }

  const scanAccounts = async () => {
    if (!publicKey) return;
    setLoading(true);

    try {
      const scanResults = await scanAllAccounts(connection, publicKey);

      if (scanResults) {
        const allAccounts: BaseAccount[] = [
          ...scanResults.tokenAccounts,
          ...scanResults.openOrders,
          ...scanResults.undeployedTokens,
          ...scanResults.unknownAccounts
        ].map(account => ({
          ...account,
          pubkey: new PublicKey(account.pubkey),
          rentExemption: account.rentExemption || 0,
          tokenInfo: account.tokenInfo || {
            name: account.type === 'token' ? 'Unknown Token' : account.type,
            symbol: account.type === 'token' ? 'UNKNOWN' : account.type.toUpperCase(),
            usdValue: 0
          }
        })) as BaseAccount[];

        setAccounts(allAccounts);
        setSecurityCheck(await checkTransactionSecurity(connection, publicKey, { accounts: scanResults }));
      }
    } catch (error) {
      logger.error('Error scanning accounts', { error });
      toast({
        title: "Error scanning accounts",
        description: "Failed to scan accounts. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const closeAccounts = async () => {
    if (!publicKey || !connection) return;

    setClosing(true);
    try {
      for (const account of accounts.filter(a => a.isCloseable)) {
        await closeTokenAccount(
          connection,
          publicKey,
          account.pubkey,
          sendTransaction
        );
      }

      await scanAccounts();
      setShowBigConfetti(true)
      setShowScanResults(false)
      toast({
        title: "Success! 🎉",
        description: "All SOL has been sent to your wallet",
        className: "bg-green-500/20 border-green-500/20"
      });
      setTimeout(() => setShowBigConfetti(false), 5000)

      // Save to museum if eligible
      if (accounts.length > 0) {
        await fetch('/api/reclaims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            totalAccounts: accounts.filter(a => a.isCloseable).length,
            totalReclaimed: getTotalReclaimAmount(accounts),
            walletAddress: publicKey.toString(),
            tokenHolder: isTokenHolder,
            personalMessage: isTokenHolder ? personalMessage : undefined
          })
        });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast({
        title: "Error closing accounts",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setClosing(false);
    }
  };

  const getTotalReclaimAmount = (accounts: BaseAccount[]) => {
    return accounts
      .filter(account => account.isCloseable)
      .reduce((total) => total + RENT_AFTER_FEE, 0);
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-black">
      <StarField />
      {showBigConfetti && <Confetti duration={5000} />}

      {/* Base content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Cosmic Dust */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(88,28,135,0.15),transparent_80%)] animate-pulse" />

        {/* Navbar - fixed at top */}
        <nav className="fixed top-0 left-0 right-0 z-20 bg-black/50 backdrop-blur-lg border-b border-purple-500/20 safe-top">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-14 md:h-16">
              <div className="flex items-center gap-2 md:gap-6">
                <div className="flex items-center gap-2">
                  <Image
                    src="/voidora-logo.svg"
                    alt="Voidora Logo"
                    width={28}
                    height={28}
                    className="rounded-full md:w-8 md:h-8"
                  />
                  <div className="text-lg md:text-xl font-bold text-purple-400">Solanare</div>
                </div>
                <div className="hidden md:flex items-center gap-4">
                  <Link
                    href="/museum"
                    className="text-purple-300/70 hover:text-purple-300 transition-colors flex items-center gap-1"
                  >
                    Museum 🏛️
                  </Link>
                  <Link
                    href="/bump"
                    className="text-purple-300/70 hover:text-purple-300 transition-colors flex items-center gap-1"
                  >
                    Bump 🚀
                  </Link>
                </div>
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <WalletMultiButton className="!bg-gradient-to-r from-purple-500 to-blue-500 !rounded-full !px-4 !py-2 !text-sm md:!text-base" />
              </motion.div>
            </div>
          </div>
        </nav>

        {/* Main scrollable content */}
        <main className="flex-1 z-10 pb-24 md:pb-32">
          <div className="container max-w-6xl mx-auto px-4 pt-20 md:pt-24">
            <div className="min-h-[calc(100dvh-16rem)] flex flex-col items-center justify-center">

              {/* Scam Protection Message */}
              {publicKey && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="w-full flex justify-center items-center mb-8"
                >
                  <div className="bg-green-900/30 text-green-400 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    Scam Protection Active
                  </div>
                </motion.div>
              )}

              <h1 className="text-7xl font-bold mb-6 leading-tight tracking-tight text-center">
                <span className="block bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 text-transparent bg-clip-text">
                  Void. Vanish. Value.
                </span>
              </h1>

              <p className="text-2xl text-purple-300/70 mb-12 max-w-2xl mx-auto text-center">
                Watch your zero-balance accounts disappear into the cosmic void, reclaiming precious SOL
              </p>

              {/* Add Token Info Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 p-4 bg-purple-900/20 border border-purple-500/20 rounded-lg max-w-xl mx-auto"
              >
                <div className="text-center space-y-3">
                  <h3 className="text-xl md:text-2xl font-semibold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                    $SOLANARE Token
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                    <div className="w-full sm:w-auto group relative cursor-pointer"
                      onClick={() => {
                        navigator.clipboard.writeText("14ornfnSSU2Gr23hhru7mAUpUM68H4rx13B2YMWb6ume");
                        trackEvent('token_address_clicked', {
                          source: 'address_display'
                        });
                        toast({
                          title: "Address Copied",
                          description: "Token address copied to clipboard",
                        });
                      }}
                    >
                      <code className="block w-full sm:w-auto bg-black/30 px-3 py-2 rounded-lg text-purple-300 font-mono text-xs sm:text-sm break-all sm:break-normal">
                        14ornfnSSU2Gr23hhru7mAUpUM68H4rx13B2YMWb6ume
                      </code>
                      <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/5 transition-colors rounded-lg" />
                    </div>

                    {/* Desktop Copy Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden md:flex h-8 w-8 text-purple-400 hover:text-purple-300 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText("14ornfnSSU2Gr23hhru7mAUpUM68H4rx13B2YMWb6ume");
                        trackEvent('token_address_copied', {
                          source: 'desktop_button'
                        });
                        toast({
                          title: "Address Copied",
                          description: "Token address copied to clipboard",
                        });
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </Button>

                    {/* Mobile Actions */}
                    <div className="flex items-center gap-2 sm:hidden">
                      <Button
                        variant="ghost"
                        className="md:hidden text-sm text-purple-400 hover:text-purple-300"
                        onClick={() => {
                          navigator.clipboard.writeText("14ornfnSSU2Gr23hhru7mAUpUM68H4rx13B2YMWb6ume");
                          trackEvent('token_address_copied', {
                            source: 'mobile_button'
                          });
                          toast({
                            title: "Address Copied",
                            description: "Token address copied to clipboard",
                          });
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </Button>
                      <Link href="/bump">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-purple-400 hover:text-purple-300"
                        >
                          <span className="text-lg">🚀</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-purple-300/70">
                    Now available on Moonshot 🚀
                  </p>
                </div>
              </motion.div>

              <motion.div className="mb-8 space-y-4">
                <h4 className="text-lg font-semibold text-purple-300">Token Holder Benefits</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-500/20">
                    <h5 className="font-medium text-purple-300 mb-2">Premium Display 💎</h5>
                    <p className="text-sm text-purple-300/70">Featured placement in Solanare Museum with custom themes</p>
                  </div>
                  <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-500/20">
                    <h5 className="font-medium text-purple-300 mb-2">Reduced Platform Fees </h5>
                    <p className="text-sm text-purple-300/70">Reduced platform fees on account closures</p>
                  </div>
                  <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-500/20">
                    <h5 className="font-medium text-purple-300 mb-2">Custom Messages ✍</h5>
                    <p className="text-sm text-purple-300/70">Add personal messages to your reclaim cards</p>
                  </div>
                  <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-500/20">
                    <h5 className="font-medium text-purple-300 mb-2">Priority Support 🎯</h5>
                    <p className="text-sm text-purple-300/70">Direct access to developer support</p>
                  </div>
                </div>
              </motion.div>

              {isTokenHolder && (
                <div className="mb-4">
                  <label className="block text-sm text-purple-300 mb-2">Personal Message</label>
                  <input
                    type="text"
                    value={personalMessage}
                    onChange={(e) => {
                      handleMessageChange(e);
                      trackEvent('personal_message_input', {
                        messageLength: e.target.value.length,
                        isTokenHolder
                      });
                    }}
                    maxLength={100}
                    className={`w-full bg-black/30 border ${messageError ? 'border-red-500' : 'border-purple-500/20'} rounded-lg px-4 py-2 text-purple-300 placeholder-purple-300/50`}
                    placeholder="Add your personal message (Token Holder Exclusive)"
                  />
                  {messageError && (
                    <p className="text-xs text-red-500 mt-1">{messageError}</p>
                  )}
                </div>
              )}

              {publicKey ? (
                <div className="space-y-8">
                  <div className="flex justify-center gap-4">
                    <Button
                      onClick={() => {
                        trackEvent('scan_accounts_clicked', {
                          walletConnected: !!publicKey,
                          previousScanResults: accounts.length
                        });
                        scanAccounts();
                      }}
                      disabled={loading || !publicKey}
                      className="relative px-8 py-6 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl text-lg font-semibold"
                    >
                      {loading ? "Scanning..." : "Scan Accounts"}
                    </Button>
                    <div className="text-sm text-purple-300/70 mb-2">
                      A {isTokenHolder ? '3' : '5'}% platform fee applies to reclaimed SOL
                      {isCheckingTokenHolder && <span className="ml-2 animate-pulse">Checking status...</span>}
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-purple-300/50 flex items-center justify-center gap-2"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                  </span>
                  Connect your wallet to begin
                </motion.div>
              )}
            </div>
          </div>
        </main>

        {/* Mobile navigation */}
        <div className="fixed bottom-5 left-0 right-0 z-20 md:hidden bg-black/50 backdrop-blur-lg border-t border-purple-500/20 safe-bottom">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-around h-16">
              <Link
                href="/"
                onClick={() => trackEvent('mobile_nav_clicked', { destination: 'home' })}
                className="flex flex-col items-center gap-1 text-purple-300/70 hover:text-purple-300"
              >
                <span className="text-lg">🏠</span>
                <span className="text-xs">Home</span>
              </Link>
              <Link
                href="/museum"
                onClick={() => trackEvent('mobile_nav_clicked', { destination: 'museum' })}
                className="flex flex-col items-center gap-1 text-purple-300/70 hover:text-purple-300"
              >
                <span className="text-lg">🏛️</span>
                <span className="text-xs">Museum</span>
              </Link>
              <Link
                href="/bump"
                onClick={() => trackEvent('mobile_nav_clicked', { destination: 'bump' })}
                className="flex flex-col items-center gap-1 text-purple-300/70 hover:text-purple-300"
              >
                <span className="text-lg">🚀</span>
                <span className="text-xs">Bump</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-20 bg-black/80 backdrop-blur-sm border-t border-purple-500/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-0">
            <div className="text-xs sm:text-sm text-purple-300/50 text-center sm:text-left">
              <p>© 2024 Solanare. All rights reserved.</p>
              <p>Built with ❤️ for the Solana community</p>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
              <a
                href="mailto:support@solana.reclaims"
                onClick={() => trackEvent('support_email_clicked')}
                className="text-xs sm:text-sm text-purple-300/50 hover:text-purple-300 transition-colors"
              >
                support@solana.reclaims
              </a>

              <a
                href="https://twitter.com/kisra_fistya"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent('twitter_link_clicked')}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-purple-300/50 hover:text-purple-300 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3 sm:h-4 sm:w-4 fill-current">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className="hidden sm:inline">@kisra_fistya</span>
                <span className="inline sm:hidden">@kisra...</span>
              </a>
            </div>
          </div>
        </div>
      </footer>

      <SecurityStatus
        isScanning={loading}
        securityCheck={securityCheck}
      />

      {publicKey && accounts.length > 0 && (
        <>
          <AccountStats
            accounts={accounts as BaseAccount[]}
            isTokenHolder={isTokenHolder}
          />
          <ScanResultsPanel
            isOpen={showScanResults}
            onToggle={() => {
              setShowScanResults(!showScanResults);
              trackEvent('scan_results_panel_toggle', {
                action: !showScanResults ? 'expand' : 'collapse',
                accountsCount: accounts.length
              });
            }}
            accounts={accounts}
            onClose={async (pubkey) => {
              setClosing(true);
              try {
                await closeTokenAccount(
                  connection,
                  publicKey,
                  pubkey,
                  sendTransaction
                );
                await scanAccounts();
                trackEvent('close_single_account', {
                  success: true,
                  accountAddress: pubkey.toString()
                });
                toast({
                  title: "Account closed successfully",
                  description: "The token account has been closed"
                });
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
                trackEvent('close_single_account', {
                  success: false,
                  error: errorMessage
                });
                toast({
                  title: "Error closing account",
                  description: errorMessage,
                  variant: "destructive"
                });
              } finally {
                setClosing(false);
              }
            }}
            isClosing={closing}
            userSolBalance={userSolBalance}
            onCloseAll={() => {
              trackEvent('close_all_accounts_initiated', {
                accountsCount: accounts.length
              });
              closeAccounts();
            }}
          />
        </>
      )}

      {showMessageInput && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-purple-900/50 p-6 rounded-xl border border-purple-500/20 max-w-md w-full mx-4"
          >
            <h3 className="text-xl font-bold text-purple-300 mb-4">Add Personal Message</h3>
            <input
              type="text"
              value={personalMessage}
              onChange={(e) => {
                handleMessageChange(e);
                trackEvent('personal_message_input', {
                  messageLength: e.target.value.length,
                  isTokenHolder
                });
              }}
              placeholder="Enter your message (optional)"
              className="w-full bg-black/50 border border-purple-500/20 rounded-lg px-4 py-2 text-purple-300 placeholder:text-purple-300/50 focus:outline-none focus:border-purple-500/50"
              maxLength={100}
            />
            {messageError && <p className="text-red-400 text-sm mt-2">{messageError}</p>}
            <div className="flex justify-end gap-4 mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  trackEvent('message_input_cancelled');
                  setShowMessageInput(false);
                  setPersonalMessage('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  trackEvent('message_input_submitted', {
                    messageLength: personalMessage.length,
                    isTokenHolder
                  });
                  setShowMessageInput(false);
                  closeAccounts();
                }}
              >
                Continue
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}