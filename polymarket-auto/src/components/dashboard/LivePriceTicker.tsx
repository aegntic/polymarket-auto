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
  const { data: markets, isLoading } = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: () => fetch('/api/markets').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const liveMarkets = useDashboardStore((s) => s.marketUpdates)

  // Merge live market updates with API data
  const mergedMarkets = useMemo(() => {
    if (!markets) return liveMarkets
    const liveMap = new Map(liveMarkets.map((m) => [m.id, m]))
    return markets.map((m) => liveMap.get(m.id) ?? m)
  }, [markets, liveMarkets])

  // Initialize deltas from market data
  const initialDeltas = useMemo(() => {
    const d: Record<string, number> = {}
    mergedMarkets.forEach((m) => {
      d[m.id] = 0
    })
    return d
  }, [mergedMarkets])

  // Simulated price deltas – changes every few seconds
  const [deltas, setDeltas] = useState<Record<string, number>>({})
  const [flashKeys, setFlashKeys] = useState<Record<string, boolean>>({})

  // Sync initial deltas when markets change
  useEffect(() => {
    setDeltas(initialDeltas)
  }, [initialDeltas])

  useEffect(() => {
    if (mergedMarkets.length === 0) return

    const interval = setInterval(() => {
      // Randomly pick ~40% of markets to update
      const newDeltas: Record<string, number> = {}
      const newFlashes: Record<string, boolean> = {}
      mergedMarkets.forEach((m) => {
        if (Math.random() < 0.4) {
          const delta = (Math.random() - 0.5) * 2.0 // ±1.0 cent
          newDeltas[m.id] = Math.round(delta * 10) / 10
          newFlashes[m.id] = true
        } else {
          newDeltas[m.id] = 0
          newFlashes[m.id] = false
        }
      })
      setDeltas(newDeltas)
      setFlashKeys(newFlashes)

      // Clear flashes after 800ms
      setTimeout(() => {
        setFlashKeys((prev) => {
          const cleared = { ...prev }
          Object.keys(cleared).forEach((k) => (cleared[k] = false))
          return cleared
        })
      }, 800)
    }, 3000)

    return () => clearInterval(interval)
  }, [mergedMarkets])

  // Build ticker items
  const tickerItems: TickerItem[] = useMemo(() => {
    return mergedMarkets.map((m) => ({
      id: m.id,
      title: m.title,
      yesPrice: m.yesPrice,
      delta: deltas[m.id] ?? 0,
    }))
  }, [mergedMarkets, deltas])

  // Duplicate 2x for seamless loop
  const duplicatedItems = useMemo(
    () => [...tickerItems, ...tickerItems],
    [tickerItems]
  )

  if (isLoading || tickerItems.length === 0) {
    return (
      <div className="relative hidden h-8 items-center overflow-hidden border-b border-[#1e293b]/60 bg-[#0a0e17]/90 sm:flex">
        <div className="flex w-full items-center justify-center">
          <span className="animate-pulse font-mono text-[10px] text-[#64748b]">
            Loading market data…
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
