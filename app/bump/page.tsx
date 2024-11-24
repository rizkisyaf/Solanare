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
    const { trackEvent } = useAnalytics()
    const [bumpHistory, setBumpHistory] = useState<BumpRecord[]>([])
    const [loadingHistory, setLoadingHistory] = useState(true)

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
            const data = await response.json()
            setBumpHistory(data)
        } catch (error) {
            console.error('Error fetching bump history:', error)
        } finally {
            setLoadingHistory(false)
        }
    }

    const handleBump = async () => {
        if (!publicKey || loading || Date.now() - lastBump < getCooldownTime(isHolder)) return;

        setLoading(true);
        try {
            Sentry.setUser({ id: publicKey.toString() });

            const tx = await createBumpTransaction(connection, publicKey);
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

            trackEvent('bump_success', {
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
                        <div className="flex items-center justify-between h-16">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <Image
                                        src="/voidora-logo.svg"
                                        alt="Voidora Logo"
                                        width={32}
                                        height={32}
                                    />
                                    <div className="text-xl font-bold text-purple-400">Solanare.claims</div>
                                </div>
                                <Link
                                    href="/"
                                    className="text-purple-300/70 hover:text-purple-300 transition-colors flex items-center gap-1"
                                >
                                    ← Back to Void
                                </Link>
                            </div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                <WalletMultiButton className="!bg-gradient-to-r from-purple-500 to-blue-500 !rounded-full" />
                            </motion.div>
                        </div>
                    </div>
                </nav>

                <main className="flex-1 container mx-auto px-4 pt-24">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-2xl mx-auto text-center"
                    >
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent mb-6">
                            $SOLANARE Token Bumper
                        </h1>

                        {/* Token info and bump button implementation */}
                        <div className="space-y-8">
                            {publicKey ? (
                                <>
                                    <Button
                                        onClick={handleBump}
                                        disabled={!canBump}
                                        className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-8 py-3 rounded-full"
                                    >
                                        {loading ? "Bumping..." :
                                            !canBump ? `Next bump in ${Math.ceil(timeUntilNextBump / 60000)}m` :
                                                "Bump $SOLANARE 🚀"}
                                    </Button>

                                    {!isHolder && (
                                        <p className="text-sm text-purple-300/70">
                                            Hold $SOLANARE tokens to reduce cooldown time
                                        </p>
                                    )}
                                </>
                            ) : (
                                <p className="text-purple-300/70">Connect wallet to start bumping</p>
                            )}
                        </div>

                        <div className="mt-16">
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent mb-6">
                                Recent Bumps
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                                {bumpHistory.map((bump) => (
                                    <motion.div
                                        key={bump.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`
          p-4 rounded-lg backdrop-blur-sm
          ${bump.isHolder
                                                ? 'bg-purple-900/20 border-2 border-purple-500/50'
                                                : 'bg-black/30 border border-purple-500/20'}
        `}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-sm text-purple-300/70">
                                                {new Date(bump.timestamp).toLocaleString()}
                                            </div>
                                            {bump.isHolder && (
                                                <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-2 py-0.5 rounded-full text-xs">
                                                    Token Holder 💎
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-sm font-mono text-purple-300">
                                            {bump.walletAddress.slice(0, 4)}...{bump.walletAddress.slice(-4)}
                                        </div>
                                        <a
                                            href={`https://solscan.io/tx/${bump.signature}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-purple-300/50 hover:text-purple-300 transition-colors"
                                        >
                                            View Transaction ↗
                                        </a>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </main>
            </div>
        </div>
    )
} 