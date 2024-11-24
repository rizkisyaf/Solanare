'use client'

import { motion } from "framer-motion"
import { useEffect, useState, useRef } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { ReclaimCard } from "@/components/ReclaimCard"
import html2canvas from 'html2canvas'
import { useToast } from "@/components/ui/use-toast"
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { StarField } from '@/components/StarField'
import Link from 'next/link'

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
)

interface ReclaimRecord {
  id: string
  totalAccounts: number
  totalReclaimed: number
  walletAddress: string
  timestamp: string
  tokenHolder: boolean
  personalMessage?: string
}

export default function MuseumPage() {
  const [reclaims, setReclaims] = useState<ReclaimRecord[]>([])
  const [loading, setLoading] = useState(true)
  const { publicKey } = useWallet()
  const { toast } = useToast()
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  useEffect(() => {
    fetchReclaims()
  }, [])

  const fetchReclaims = async () => {
    try {
      const response = await fetch('/api/reclaims')
      const data = await response.json()
      setReclaims(data)
    } catch (error) {
      console.error('Error fetching reclaims:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleShare = async (reclaimId: string, isTokenHolder: boolean) => {
    const cardElement = cardRefs.current[reclaimId]
    if (!cardElement) return

    try {
      const canvas = await html2canvas(cardElement, {
        backgroundColor: null,
        scale: 2,
      })

      if (isTokenHolder) {
        // Download for token holders
        const link = document.createElement('a')
        link.download = `solanare-reclaim-${reclaimId}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      }

      // Share for all users
      const blob = await new Promise<Blob>((resolve) => 
        canvas.toBlob((blob) => resolve(blob!))
      )
      const file = new File([blob], 'reclaim.png', { type: 'image/png' })
      
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: 'My Solana Reclaim',
          text: 'Check out my Solana token account reclaim on Solanare!'
        })
      } else {
        // Fallback to clipboard
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])
        toast({
          title: "Image Copied!",
          description: "Share image copied to clipboard"
        })
      }
    } catch (error) {
      console.error('Error sharing/downloading:', error)
      toast({
        title: "Error",
        description: "Failed to share/download image",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <StarField />
      
      {/* Cosmic Dust */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(88,28,135,0.15),transparent_80%)] animate-pulse" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Navbar - copied from page.tsx */}
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
                    className="rounded-full"
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

        <main className="pt-24 min-h-screen">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-16"
            >
              <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent mb-6">
                Hall of Reclaims
              </h1>
              <p className="text-xl text-purple-300/70 max-w-2xl mx-auto">
                Immortalized in the cosmic void, these brave souls have reclaimed their SOL from the depths of forgotten accounts.
              </p>
            </motion.div>

            {/* Museum Gallery */}
            <div className="relative">
              {/* Spotlight Effects */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,28,135,0.15),transparent_50%)]" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative">
                {reclaims.map((reclaim, index) => (
                  <motion.div
                    key={reclaim.id}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`
                      relative backdrop-blur-sm
                      ${reclaim.tokenHolder 
                        ? 'bg-purple-900/20 border-2 border-purple-500/50 shadow-lg shadow-purple-500/20' 
                        : 'bg-black/30 border border-purple-500/20'}
                      rounded-xl overflow-hidden
                      transform hover:scale-105 transition-all duration-300
                    `}
                    ref={(el) => {
                      cardRefs.current[reclaim.id] = el
                    }}
                  >
                    {reclaim.tokenHolder && (
                      <div className="absolute -top-3 -right-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium shadow-lg">
                        Token Holder 💎
                      </div>
                    )}
                    <ReclaimCard
                      totalAccounts={reclaim.totalAccounts}
                      totalReclaimed={reclaim.totalReclaimed}
                      walletAddress={reclaim.walletAddress}
                      onShare={() => handleShare(reclaim.id, reclaim.tokenHolder)}
                      isTokenHolder={reclaim.tokenHolder}
                      personalMessage={reclaim.personalMessage}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-6 border-t border-purple-500/20 mt-20">
          <div className="container mx-auto px-4 text-center text-purple-300/50 text-sm">
            <p>© 2024 Solanare. All rights reserved.</p>
            <p className="mt-2">Preserving the history of Solana account reclamations</p>
          </div>
        </footer>
      </div>
    </div>
  )
} 