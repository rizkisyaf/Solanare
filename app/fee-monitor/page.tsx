'use client'

import { FeeOptimizer } from '@/components/FeeOptimizer'
import { StarField } from '@/components/StarField'

export default function FeeMonitorPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <StarField />
      
      {/* Cosmic Dust */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(88,28,135,0.15),transparent_80%)] animate-pulse" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <main className="flex-1 container mx-auto px-4 pt-24">
          <FeeOptimizer />
        </main>
      </div>
    </div>
  )
} 