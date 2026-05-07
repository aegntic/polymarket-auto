'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useDashboardStore, type Market } from '@/lib/store'

/** Abbreviate long market titles for the ticker strip */
function abbreviate(title: string, maxLen = 32): string {
  if (title.length <= maxLen) return title
  return title.slice(0, maxLen - 1) + '…'
}

interface TickerItem {
  id: string
  title: string
  yesPrice: number
  delta: number // simulated price change in cents
}

function TickerEntry({ item, flash }: { item: TickerItem; flash: boolean }) {
  const priceCents = (item.yesPrice * 100 + item.delta).toFixed(1)
  const isUp = item.delta >= 0
  const showArrow = item.delta !== 0

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[12px]">
      <span className="text-[#94a3b8]">{abbreviate(item.title)}</span>
      <span
        className={`font-bold transition-colors duration-300 ${
          isUp ? 'text-[#00ff41]' : 'text-[#ef4444]'
        } ${flash ? (isUp ? 'glow-green' : 'glow-red') : ''}`}
      >
        {priceCents}¢
      </span>
      {showArrow && (
        isUp ? (
          <TrendingUp className="h-3 w-3 text-[#00ff41]" />
        ) : (
          <TrendingDown className="h-3 w-3 text-[#ef4444]" />
        )
      )}
      <span className="mx-1.5 text-[#1e293b]">·</span>
    </span>
  )
}

export function LivePriceTicker() {
  const markets = useDashboardStore((s) => s.marketUpdates)
  const [deltas, setDeltas] = useState<Record<string, number>>({})
  const [flashKeys, setFlashKeys] = useState<Record<string, boolean>>({})

  // Simulated price deltas – changes every 5 seconds
  useEffect(() => {
    if (markets.length === 0) return

    const interval = setInterval(() => {
      const newDeltas: Record<string, number> = {}
      const newFlashes: Record<string, boolean> = {}
      
      // Only update a small subset for performance
      const updateCount = Math.floor(markets.length * 0.3)
      for (let i = 0; i < updateCount; i++) {
        const idx = Math.floor(Math.random() * markets.length)
        const m = markets[idx]
        const delta = (Math.random() - 0.5) * 1.5
        newDeltas[m.id] = Math.round(delta * 10) / 10
        newFlashes[m.id] = true
      }
      
      setDeltas(newDeltas)
      setFlashKeys(newFlashes)

      setTimeout(() => setFlashKeys({}), 1000)
    }, 5000)

    return () => clearInterval(interval)
  }, [markets])

  const tickerItems = useMemo(() => {
    return markets.map((m) => ({
      id: m.id,
      title: m.title,
      yesPrice: m.yesPrice,
      delta: deltas[m.id] ?? 0,
    }))
  }, [markets, deltas])

  const duplicatedItems = useMemo(() => [...tickerItems, ...tickerItems], [tickerItems])

  if (markets.length === 0) {
    return (
      <div className="relative hidden h-8 items-center overflow-hidden border-b border-[#1e293b]/60 bg-[#0a0e17]/90 sm:flex">
        <div className="flex w-full items-center justify-center">
          <span className="font-mono text-[10px] text-[#64748b]">
            Waiting for market data…
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative hidden h-8 items-center overflow-hidden border-b border-[#1e293b]/60 bg-[#0a0e17]/90 sm:flex">
      {/* Left gradient fade */}
      <div className="pointer-events-none absolute left-0 z-10 h-8 w-16 bg-gradient-to-r from-[#0a0e17] to-transparent" />
      {/* Right gradient fade */}
      <div className="pointer-events-none absolute right-0 z-10 h-8 w-16 bg-gradient-to-l from-[#0a0e17] to-transparent" />

      {/* Scrolling content */}
      <motion.div
        className="animate-ticker flex items-center gap-0 whitespace-nowrap"
        initial={{ x: 0 }}
      >
        {duplicatedItems.map((item, idx) => (
          <TickerEntry
            key={`${item.id}-${idx}`}
            item={item}
            flash={!!flashKeys[item.id]}
          />
        ))}
      </motion.div>
    </div>
  )
}
