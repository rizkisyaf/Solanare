'use client'

import { useEffect, useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { useToast } from "@/components/ui/use-toast"
import { motion } from "framer-motion"
import { StarField } from '@/components/StarField'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { createBumpTransaction } from "../utils/jupiter"
import { checkTokenHolder } from "../utils/token"
import { useAnalytics } from "../hooks/useAnalytics"
import dynamic from 'next/dynamic'
import * as Sentry from "@sentry/nextjs"
import { getCooldownTime } from "../utils/jupiter"
import { BumpRecord } from "../types/bump"

const WalletMultiButton = dynamic(
    () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
    { ssr: false }
)

export default function BumpPage() {
    const [lastBump, setLastBump] = useState<number>(0)
    const [loading, setLoading] = useState(false)
    const [isHolder, setIsHolder] = useState(false)
    const { publicKey, sendTransaction } = useWallet()
    const { connection } = useConnection()
    const { toast } = useToast()
    const { track } = useAnalytics()
    const [bumpHistory, setBumpHistory] = useState<BumpRecord[]>([])
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [bumpAmount, setBumpAmount] = useState<number>(0.01)

    useEffect(() => {
        const checkStatus = async () => {
            if (!publicKey) return
            const status = await checkTokenHolder(publicKey)
            setIsHolder(status)

            // Load last bump time from localStorage
            const stored = localStorage.getItem(`lastBump_${publicKey.toString()}`)
            if (stored) setLastBump(parseInt(stored))
        }

        checkStatus()
    }, [publicKey])

    useEffect(() => {
        fetchBumpHistory()
    }, [])

    const fetchBumpHistory = async () => {
        try {
            const response = await fetch('/api/bumps')
            if (!response.ok) {
                throw new Error('Failed to fetch bump history')
            }
            const data = await response.json()
            setBumpHistory(Array.isArray(data) ? data : [])
        } catch (error) {
            console.error('Error fetching bump history:', error)
            setBumpHistory([])
        } finally {
            setLoadingHistory(false)
        }
    }

    const handleBump = async (amount: number) => {
        if (!publicKey || loading || Date.now() - lastBump < getCooldownTime(isHolder)) return;

        setLoading(true);
        try {
            Sentry.setUser({ id: publicKey.toString() });

            const tx = await createBumpTransaction(connection, publicKey, amount);
            const latestBlockhash = await connection.getLatestBlockhash('finalized');
            tx.recentBlockhash = latestBlockhash.blockhash;
            tx.feePayer = publicKey;

            const signature = await sendTransaction(tx, connection, {
                skipPreflight: true,
                maxRetries: 3
            });

            const confirmation = await connection.confirmTransaction({
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
            });

            if (confirmation.value.err) {
                throw new Error('Transaction failed');
            }

            const now = Date.now();
            localStorage.setItem(`lastBump_${publicKey.toString()}`, now.toString());
            setLastBump(now);

            track('bump_success', {
                wallet: publicKey.toString(),
                signature,
                isHolder
            });

            toast({
                title: "Success!",
                description: `Token bumped! Next bump available in ${isHolder ? '30' : '60'} minutes 🚀`,
            });

            const newBump: BumpRecord = {
                id: signature,
                walletAddress: publicKey.toString(),
                timestamp: new Date().toISOString(),
                isHolder,
                signature
            }
            setBumpHistory(prev => [newBump, ...prev])

            try {
                await fetch('/api/bumps', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newBump)
                })
                setBumpHistory(prev => [newBump, ...prev])
            } catch (error) {
                console.error('Failed to save bump history:', error)
            }
        } catch (error) {
            Sentry.captureException(error, {
                tags: {
                    wallet: publicKey.toString(),
                    isHolder: isHolder.toString(),
                    operation: 'bump_token'
                }
            });

            toast({
                title: "Error",
                description: "Failed to bump token. Please try again later.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const timeUntilNextBump = Math.max(0, getCooldownTime(isHolder) - (Date.now() - lastBump));
    const canBump = timeUntilNextBump === 0 && !loading;

    return (
        <div className="relative min-h-screen overflow-hidden bg-black">
            <StarField />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(88,28,135,0.15),transparent_80%)] animate-pulse" />

            {/* Rest of the UI implementation referencing museum/page.tsx */}
            <div className="relative z-10 flex flex-col min-h-screen">
                <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-lg border-b border-purple-500/20">
                    <div className="container mx-auto px-4">
                        <div className="flex items-center justify-between h-14 md:h-16">
                            <div className="flex items-center gap-2 md:gap-6">
                                <div className="flex items-center gap-2">
                                    <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                        <Image
                                            src="/voidora-logo.svg"
                                            alt="Voidora Logo"
                                            width={28}
                                            height={28}
                                            className="w-6 h-6 md:w-8 md:h-8"
                                        />
                                        <div className="text-lg md:text-xl font-bold text-purple-400">Solanare</div>
                                    </Link>
                                </div>
                            </div>
                            <WalletMultiButton className="!bg-gradient-to-r from-purple-500 to-blue-500 !rounded-full !px-3 !py-1.5 !text-sm md:!text-base md:!px-4 md:!py-2" />
                        </div>
                    </div>
                </nav>

                <main className="flex-1 container mx-auto px-4 pt-20 md:pt-24">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-2xl mx-auto text-center"
                    >
                        <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent mb-4 md:mb-6">
                            $SOLANARE Token Bumper
                        </h1>

                        {/* Token info and bump button implementation */}
                        <div className="space-y-6 md:space-y-8">
                            {publicKey ? (
                                <>
                                    <div className="flex flex-col items-center gap-3 md:gap-4">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                value={bumpAmount}
                                                onChange={(e) => {
                                                    const newAmount = Math.max(0.01, Number(e.target.value));
                                                    setBumpAmount(newAmount);
                                                    track('bump_amount_changed', {
                                                        amount: newAmount,
                                                        isHolder
                                                    });
                                                }}
                                                className="w-20 md:w-24 px-2 md:px-3 py-1.5 md:py-2 bg-purple-900/20 border border-purple-500/20 rounded-lg text-purple-300 focus:outline-none focus:border-purple-500 text-sm md:text-base"
                                            />
                                            <span className="text-purple-300 text-sm md:text-base">SOL</span>
                                        </div>
                                        <Button
                                            onClick={() => handleBump(bumpAmount)}
                                            disabled={!canBump}
                                            className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 md:px-8 py-2 md:py-3 rounded-full text-sm md:text-base"
                                        >
                                            {loading ? "Bumping..." :
                                                !canBump ? `Next bump in ${Math.ceil(timeUntilNextBump / 60000)}m` :
                                                    "Bump $SOLANARE 🚀"}
                                        </Button>
                                    </div>

                                    {!isHolder && (
                                        <p className="text-xs md:text-sm text-purple-300/70">
                                            Hold $SOLANARE tokens to reduce cooldown time
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm md:text-base text-purple-300/70">Connect wallet to start bumping</p>
                            )}
                        </div>

                        <div className="mt-12 md:mt-16">
                            <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent mb-4 md:mb-6">
                                Recent Bumps
                            </h2>

                            {!loadingHistory && bumpHistory && bumpHistory.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 max-w-4xl mx-auto">
                                    {bumpHistory.map((bump) => (
                                        <motion.div
                                            key={bump.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`
          p-3 md:p-4 rounded-lg backdrop-blur-sm
          ${bump.isHolder
                                                ? 'bg-purple-900/20 border-2 border-purple-500/50'
                                                : 'bg-black/30 border border-purple-500/20'}
        `}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="text-xs md:text-sm text-purple-300/70">
                                                    {new Date(bump.timestamp).toLocaleString()}
                                                </div>
                                                {bump.isHolder && (
                                                    <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-2 py-0.5 rounded-full text-xs">
                                                        Token Holder 💎
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs md:text-sm font-mono text-purple-300">
                                                {bump.walletAddress.slice(0, 4)}...{bump.walletAddress.slice(-4)}
                                            </div>
                                            <a
                                                href={`https://solscan.io/tx/${bump.signature}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => track('view_transaction_clicked', {
                                                    signature: bump.signature,
                                                    isHolder: bump.isHolder
                                                })}
                                                className="text-xs text-purple-300/50 hover:text-purple-300 transition-colors"
                                            >
                                                View Transaction ↗
                                            </a>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-purple-300/70">No bumps yet</p>
                            )}
                        </div>
                    </motion.div>
                </main>
            </div>
        </div>
    )
} 