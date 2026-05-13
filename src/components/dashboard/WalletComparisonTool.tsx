'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import { GitCompare, X, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Wallet } from '@/lib/store'

/* ─── Slot Configuration ─── */
const SLOT_COLORS = ['#00ff41', '#22d3ee', '#f59e0b'] as const
const SLOT_LABELS = ['Wallet A', 'Wallet B', 'Wallet C'] as const

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/* ─── Main Component ─── */
export function WalletComparisonTool() {
  const [selectedSlots, setSelectedSlots] = useState<(string | null)[]>([null, null, null])

  // Fetch wallets
  const { data: wallets, isLoading, error } = useQuery<Wallet[]>({
    queryKey: ['wallets'],
    queryFn: () => fetch('/api/wallets').then((r) => r.json()),
    refetchInterval: 60000,
  })

  // Get selected wallet objects
  const selectedWallets = useMemo(() => {
    return selectedSlots
      .map((walletId, idx) => {
        if (!walletId || !wallets) return null
        const wallet = wallets.find((w) => w.id === walletId)
        return wallet ? { wallet, slotIndex: idx } : null
      })
      .filter((item): item is { wallet: Wallet; slotIndex: number } => item !== null)
  }, [selectedSlots, wallets])

  const activeCount = selectedWallets.length
  const canCompare = activeCount >= 2

  // Wallet data
  const walletData = useMemo(() => {
    return selectedWallets.map(({ wallet, slotIndex }) => ({
      wallet,
      slotIndex,
      color: SLOT_COLORS[slotIndex],
      label: wallet.label || truncateAddress(wallet.address),
      trajectory: [], // No simulated trajectory
      metrics: {
        totalPnl: wallet.totalPnl,
        winRate: wallet.winRate,
        totalTrades: wallet.totalTrades,
        avgPositionSize: wallet.avgPositionSize,
        edgeScore: wallet.edgeScore,
        sharpeEstimate: 0,
        consistency: wallet.winRate,
      },
    }))
  }, [selectedWallets])

  // Build comparison metrics from real wallet data
  const comparisonRows = useMemo(() => {
    if (walletData.length < 2) return []

    const rows = [
      { key: 'totalPnl' as const, label: 'Total P&L', format: (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, higherIsBetter: true },
      { key: 'winRate' as const, label: 'Win Rate', format: (v: number) => `${(v * 100).toFixed(1)}%`, higherIsBetter: true },
      { key: 'totalTrades' as const, label: 'Total Trades', format: (v: number) => v.toLocaleString(), higherIsBetter: true },
      { key: 'edgeScore' as const, label: 'Edge Score', format: (v: number) => (v * 100).toFixed(1), higherIsBetter: true },
    ]

    return rows.map((row) => {
      const values = walletData.map((wd) => ({
        label: wd.label || truncateAddress(wd.wallet.address),
        color: wd.color,
        slotIndex: wd.slotIndex,
        value: wd.wallet[row.key],
      }))

      const bestValue = row.higherIsBetter
        ? Math.max(...values.map((v) => v.value))
        : Math.min(...values.map((v) => v.value))
      const worstValue = row.higherIsBetter
        ? Math.min(...values.map((v) => v.value))
        : Math.max(...values.map((v) => v.value))

      return { ...row, values, bestValue, worstValue }
    })
  }, [walletData])

  // Compute head-to-head verdict
  const verdict = useMemo(() => {
    if (walletData.length < 2) return null

    const wins: Record<string, number> = {}
    for (const wd of walletData) {
      wins[wd.label] = 0
    }

    for (const row of comparisonRows) {
      for (const v of row.values) {
        if (v.value === row.bestValue) {
          wins[v.label] = (wins[v.label] || 0) + 1
        }
      }
    }

    const sorted = Object.entries(wins).sort((a, b) => b[1] - a[1])
    const leader = sorted[0]
    const totalMetrics = comparisonRows.length

    return { wins, leader, totalMetrics, sorted }
  }, [comparisonRows, walletData])

  // Slot handlers
  const handleSlotChange = useCallback((slotIndex: number, walletId: string) => {
    setSelectedSlots((prev) => {
      const next = [...prev]
      next[slotIndex] = walletId || null
      return next
    })
  }, [])

  const handleSlotClear = useCallback((slotIndex: number) => {
    setSelectedSlots((prev) => {
      const next = [...prev]
      next[slotIndex] = null
      return next
    })
  }, [])

  // Available wallets for a slot
  const getAvailableWallets = useCallback(
    (slotIndex: number) => {
      if (!wallets) return []
      const otherSelected = selectedSlots.filter((_, i) => i !== slotIndex).filter(Boolean) as string[]
      return wallets.filter((w) => !otherSelected.includes(w.id))
    },
    [wallets, selectedSlots]
  )

  if (error) {
    return (
      <Card className="card-accent-cyan rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-cyan-400" />
            <span className="card-title-cyber">WALLET COMPARISON</span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load wallet data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-cyan rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-cyan-400" />
              <span className="card-title-cyber">WALLET COMPARISON</span>
            </div>
            <p className="mt-1 text-[10px] text-[#64748b]">
              Side-by-side wallet analysis
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-md bg-cyan-400/10 px-2 py-0.5 text-[9px] font-mono font-bold text-cyan-400">
              {activeCount}/3 SLOTS
            </span>
            {!canCompare && (
              <span className="rounded-md bg-[#f59e0b]/10 px-2 py-0.5 text-[9px] font-mono text-[#f59e0b]">
                MIN 2
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ─── Wallet Selector ─── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SLOT_COLORS.map((color, slotIndex) => {
              const selectedId = selectedSlots[slotIndex]
              const selectedWallet = selectedId && wallets ? wallets.find((w) => w.id === selectedId) : null
              const available = getAvailableWallets(slotIndex)

              return (
                <div
                  key={slotIndex}
                  className="relative flex items-center gap-2 rounded-lg border border-[#1e293b]/60 bg-[#0a0e17]/60 px-3 py-2"
                >
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor: selectedWallet ? color : `${color}30`,
                      boxShadow: selectedWallet ? `0 0 8px ${color}60` : 'none',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    {isLoading ? (
                      <Skeleton className="h-5 w-full bg-[#1e293b]/50" />
                    ) : (
                      <>
                        <div className="text-[8px] font-mono uppercase tracking-wider text-[#64748b]">
                          {SLOT_LABELS[slotIndex]}
                        </div>
                        <select
                          value={selectedId || ''}
                          onChange={(e) => handleSlotChange(slotIndex, e.target.value)}
                          className="w-full border-0 bg-transparent font-mono text-[10px] font-bold outline-none"
                          style={{ color: selectedWallet ? color : '#64748b' }}
                        >
                          <option value="" className="bg-[#0a0e17] text-[#64748b]">
                            Select wallet...
                          </option>
                          {available.map((w) => (
                            <option key={w.id} value={w.id} className="bg-[#0a0e17] text-[#e2e8f0]">
                              {w.label || truncateAddress(w.address)}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                  {selectedWallet && (
                    <button
                      onClick={() => handleSlotClear(slotIndex)}
                      className="shrink-0 rounded-md p-1 text-[#64748b] transition-colors hover:bg-[#1e293b]/60 hover:text-[#94a3b8]"
                      title="Remove wallet"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {selectedWallet && (
                    <span className="absolute -bottom-0.5 right-2 text-[8px] font-mono text-[#64748b]/60">
                      {truncateAddress(selectedWallet.address)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ─── Comparison Content ─── */}
        <AnimatePresence mode="wait">
          {canCompare ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Comparison Metrics Table */}
              <div className="rounded-lg border border-[#1e293b]/40 bg-[#0a0e17]/30 p-3">
                <div className="text-[9px] font-mono font-semibold uppercase tracking-wider text-[#64748b] mb-2">
                  Performance Comparison
                </div>
                <div className="space-y-1.5">
                  {comparisonRows.map((row) => (
                    <div key={row.key} className="flex items-center gap-2 text-[10px]">
                      <span className="w-24 shrink-0 font-mono text-[#64748b]">{row.label}</span>
                      {row.values.map((v) => {
                        const isBest = v.value === row.bestValue
                        return (
                          <div key={v.label} className="flex-1">
                            <span
                              className={`font-mono text-[10px] font-bold ${isBest ? 'text-[#00ff41]' : 'text-[#94a3b8]'}`}
                            >
                              {row.format(v.value)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Verdict */}
              {verdict && (
                <div className="rounded-lg border border-[#00ff41]/20 bg-[#00ff41]/5 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="h-4 w-4 text-[#00ff41]" />
                    <span className="text-[11px] font-bold text-[#00ff41]">WINNER</span>
                  </div>
                  <div className="font-mono text-sm font-bold text-[#00ff41]">
                    {verdict.leader[0]}
                  </div>
                  <div className="text-[9px] text-[#64748b] mt-1">
                    {verdict.wins[verdict.leader[0]]}/{verdict.totalMetrics} metrics won
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-[#64748b]">
              <GitCompare className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-xs">Select at least 2 wallets to compare</p>
            </div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
