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

/* ─── Seeded PRNG (mulberry32) ─── */
function mulberry32(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ─── Helpers ─── */
function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

/* ─── Generate 30-day P&L trajectory for a wallet ─── */
function generateTrajectory(wallet: Wallet, slotIndex: number): number[] {
  const seed = hashCode(wallet.id) + slotIndex * 1000 + 42
  const rng = mulberry32(seed)
  const rand = () => rng() * 2 - 1

  // Base parameters derived from wallet properties
  const dailyMean = wallet.totalPnl > 0 ? 0.008 + wallet.edgeScore * 0.02 : -0.003 + wallet.edgeScore * 0.01
  const dailyVol = 0.02 + (1 - wallet.winRate) * 0.04
  const trendBias = wallet.winRate > 0.55 ? 0.15 : 0

  const trajectory: number[] = [0] // Start at 0 P&L
  let cumulativePnl = 0

  for (let day = 1; day <= 30; day++) {
    const prevReturn = day > 1 ? trajectory[day - 1] - trajectory[day - 2] : 0
    const momentumComponent = prevReturn * trendBias * 2
    const shock = rand() * dailyVol
    const dailyPnl = dailyMean + momentumComponent + shock

    // Occasional large move for edge traders
    let edgeShock = 0
    if (wallet.isEdgeTrader && rng() < 0.1) {
      edgeShock = (rng() * 0.08 + 0.02) * (rand() > 0 ? 1 : -0.5)
    }

    cumulativePnl += dailyPnl * wallet.avgPositionSize * 10 + edgeShock * wallet.avgPositionSize * 10

    // Scale towards totalPnl over the 30 days
    const targetScale = wallet.totalPnl / 30
    const blendFactor = 0.3
    cumulativePnl = cumulativePnl * (1 - blendFactor) + targetScale * day * blendFactor

    trajectory.push(Math.round(cumulativePnl * 100) / 100)
  }

  return trajectory
}

/* ─── Compute derived metrics for a wallet ─── */
interface WalletMetrics {
  totalPnl: number
  winRate: number
  totalTrades: number
  avgPositionSize: number
  edgeScore: number
  sharpeEstimate: number
  consistency: number
}

function computeMetrics(wallet: Wallet, trajectory: number[]): WalletMetrics {
  // Sharpe estimate from trajectory daily returns
  const dailyReturns: number[] = []
  for (let i = 1; i < trajectory.length; i++) {
    if (trajectory[i - 1] !== 0) {
      dailyReturns.push((trajectory[i] - trajectory[i - 1]) / Math.abs(trajectory[i - 1] || 1))
    } else {
      dailyReturns.push(0)
    }
  }
  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1)
  const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (dailyReturns.length || 1)
  const stdDev = Math.sqrt(variance)
  const sharpeEstimate = stdDev > 0 ? Math.round((meanReturn / stdDev) * Math.sqrt(365) * 100) / 100 : 0

  // Consistency: % of positive days
  const positiveDays = dailyReturns.filter((r) => r > 0).length
  const consistency = dailyReturns.length > 0 ? Math.round((positiveDays / dailyReturns.length) * 100) / 100 : 0

  return {
    totalPnl: wallet.totalPnl,
    winRate: wallet.winRate,
    totalTrades: wallet.totalTrades,
    avgPositionSize: wallet.avgPositionSize,
    edgeScore: wallet.edgeScore,
    sharpeEstimate,
    consistency,
  }
}

/* ─── Radar data normalization (0-100) ─── */
function normalizeRadar(metrics: WalletMetrics, allMetrics: WalletMetrics[]): Record<string, number> {
  const maxPnl = Math.max(...allMetrics.map((m) => Math.abs(m.totalPnl)), 1)
  const maxTrades = Math.max(...allMetrics.map((m) => m.totalTrades), 1)
  const maxPosSize = Math.max(...allMetrics.map((m) => m.avgPositionSize), 1)
  const maxSharpe = Math.max(...allMetrics.map((m) => Math.abs(m.sharpeEstimate)), 0.1)

  return {
    'P&L': Math.round((metrics.totalPnl / maxPnl) * 100),
    'Win Rate': Math.round(metrics.winRate * 100),
    'Trades': Math.round((metrics.totalTrades / maxTrades) * 100),
    'Edge Score': Math.round(metrics.edgeScore * 100),
    'Position Size': Math.round((metrics.avgPositionSize / maxPosSize) * 100),
    'Consistency': Math.round(metrics.consistency * 100),
  }
}

/* ─── Custom Tooltip for Line Chart ─── */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="mb-1 font-mono text-[9px] font-bold text-[#94a3b8]">Day {label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="font-mono text-[10px] text-[#94a3b8]">{entry.dataKey}:</span>
          <span
            className="font-mono text-[10px] font-bold"
            style={{ color: entry.value >= 0 ? '#00ff41' : '#ef4444' }}
          >
            ${entry.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─── Custom Tooltip for Radar Chart ─── */
function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: Record<string, number> }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0].payload
  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      {Object.entries(data)
        .filter(([key]) => key !== 'metric')
        .map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-[#94a3b8]">{key}:</span>
            <span className="font-mono text-[10px] font-bold text-[#e2e8f0]">
              {Math.round(value as number)}%
            </span>
          </div>
        ))}
    </div>
  )
}

/* ─── Metric Row Configuration ─── */
const METRIC_ROWS: {
  key: keyof WalletMetrics
  label: string
  format: (v: number) => string
  higherIsBetter: boolean
}[] = [
  { key: 'totalPnl', label: 'Total P&L', format: (v) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, higherIsBetter: true },
  { key: 'winRate', label: 'Win Rate', format: (v) => `${(v * 100).toFixed(1)}%`, higherIsBetter: true },
  { key: 'totalTrades', label: 'Total Trades', format: (v) => v.toLocaleString(), higherIsBetter: true },
  { key: 'avgPositionSize', label: 'Avg Position Size', format: (v) => `$${v.toFixed(0)}`, higherIsBetter: false },
  { key: 'edgeScore', label: 'Edge Score', format: (v) => (v * 100).toFixed(1), higherIsBetter: true },
  { key: 'sharpeEstimate', label: 'Sharpe Estimate', format: (v) => v.toFixed(2), higherIsBetter: true },
]

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

  // Generate trajectories and metrics for selected wallets
  const walletData = useMemo(() => {
    return selectedWallets.map(({ wallet, slotIndex }) => {
      const trajectory = generateTrajectory(wallet, slotIndex)
      const metrics = computeMetrics(wallet, trajectory)
      return {
        wallet,
        slotIndex,
        color: SLOT_COLORS[slotIndex],
        label: wallet.label || truncateAddress(wallet.address),
        trajectory,
        metrics,
      }
    })
  }, [selectedWallets])

  // Build line chart data
  const chartData = useMemo(() => {
    return Array.from({ length: 31 }, (_, day) => {
      const entry: Record<string, number> = { day: day + 1 }
      for (const wd of walletData) {
        entry[wd.label] = wd.trajectory[day]
      }
      return entry
    })
  }, [walletData])

  // Build radar chart data
  const radarData = useMemo(() => {
    if (walletData.length === 0) return []

    const allMetrics = walletData.map((wd) => wd.metrics)
    const axes = ['P&L', 'Win Rate', 'Trades', 'Edge Score', 'Position Size', 'Consistency']

    return axes.map((axis) => {
      const entry: Record<string, string | number> = { metric: axis }
      for (const wd of walletData) {
        const normalized = normalizeRadar(wd.metrics, allMetrics)
        entry[wd.label] = normalized[axis]
      }
      return entry
    })
  }, [walletData])

  // Build comparison metrics with best/worst indicators
  const comparisonRows = useMemo(() => {
    if (walletData.length < 2) return []

    return METRIC_ROWS.map((row) => {
      const values = walletData.map((wd) => ({
        label: wd.label,
        color: wd.color,
        slotIndex: wd.slotIndex,
        value: wd.metrics[row.key],
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

    // Determine strengths per wallet
    const strengths: Record<string, string[]> = {}
    for (const wd of walletData) {
      strengths[wd.label] = []
    }
    for (const row of comparisonRows) {
      for (const v of row.values) {
        if (v.value === row.bestValue) {
          strengths[v.label].push(row.label)
        }
      }
    }

    return { wins, leader, totalMetrics, sorted, strengths }
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

  // Available wallets for a slot (excluding already selected in other slots)
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
                  {/* Color indicator */}
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
                  {/* Clear button */}
                  {selectedWallet && (
                    <button
                      onClick={() => handleSlotClear(slotIndex)}
                      className="shrink-0 rounded-md p-1 text-[#64748b] transition-colors hover:bg-[#1e293b]/60 hover:text-[#94a3b8]"
                      title="Remove wallet"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {/* Selected address preview */}
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
              key="comparison"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              {/* ─── Performance Comparison Chart ─── */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-[#64748b]" />
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
                    Cumulative P&L Trajectory
                  </span>
                </div>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" strokeOpacity={0.5} />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                        axisLine={{ stroke: '#1e293b' }}
                        tickLine={{ stroke: '#1e293b' }}
                        label={{
                          value: 'Day',
                          position: 'insideBottom',
                          offset: -2,
                          style: { fill: '#64748b', fontSize: 9, fontFamily: 'monospace' },
                        }}
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                        axisLine={{ stroke: '#1e293b' }}
                        tickLine={{ stroke: '#1e293b' }}
                        tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
                        label={{
                          value: 'P&L',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 15,
                          style: { fill: '#64748b', fontSize: 9, fontFamily: 'monospace' },
                        }}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace', paddingTop: '4px' }}
                        formatter={(value: string) => {
                          const wd = walletData.find((w) => w.label === value)
                          return <span style={{ color: wd?.color || '#94a3b8' }}>{value}</span>
                        }}
                      />
                      {walletData.map((wd) => (
                        <Line
                          key={wd.label}
                          type="monotone"
                          dataKey={wd.label}
                          stroke={wd.color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 3, strokeWidth: 0, fill: wd.color }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ─── Metrics Comparison Table ─── */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Minus className="h-3 w-3 text-[#64748b]" />
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
                    Metrics Comparison
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1e293b]/50">
                        <th className="pb-1.5 pr-3 text-left font-mono text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
                          Metric
                        </th>
                        {walletData.map((wd) => (
                          <th
                            key={wd.label}
                            className="pb-1.5 px-2 text-right font-mono text-[9px] font-semibold uppercase tracking-wider"
                            style={{ color: wd.color }}
                          >
                            {wd.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row) => (
                        <tr
                          key={row.key}
                          className="border-b border-[#1e293b]/20 transition-colors hover:bg-[#1e293b]/10"
                        >
                          <td className="py-1.5 pr-3 font-mono text-[10px] text-[#94a3b8]">
                            {row.label}
                          </td>
                          {row.values.map((v) => {
                            const isBest = v.value === row.bestValue
                            const isWorst = v.value === row.worstValue && row.values.length > 2
                            return (
                              <td
                                key={v.label}
                                className={`py-1.5 px-2 text-right font-mono text-[10px] font-bold ${
                                  isBest
                                    ? 'text-[#00ff41]'
                                    : isWorst
                                      ? 'text-[#ef4444]/80'
                                      : 'text-[#e2e8f0]'
                                }`}
                              >
                                <span
                                  className={`inline-block rounded px-1 ${
                                    isBest
                                      ? 'bg-[#00ff41]/10'
                                      : isWorst
                                        ? 'bg-[#ef4444]/5'
                                        : ''
                                  }`}
                                >
                                  {row.format(v.value)}
                                  {isBest && (
                                    <span className="ml-1 inline-block text-[8px] text-[#00ff41]">
                                      &#9650;
                                    </span>
                                  )}
                                  {isWorst && !isBest && (
                                    <span className="ml-1 inline-block text-[8px] text-[#ef4444]/60">
                                      &#9660;
                                    </span>
                                  )}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ─── Radar/Spider Chart ─── */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <GitCompare className="h-3 w-3 text-[#64748b]" />
                  <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
                    Wallet Shape Profile
                  </span>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="#1e293b" strokeOpacity={0.5} />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                      />
                      <PolarRadiusAxis
                        tick={{ fill: '#64748b', fontSize: 8, fontFamily: 'monospace' }}
                        axisLine={false}
                        tickCount={5}
                        domain={[0, 100]}
                      />
                      <Tooltip content={<RadarTooltip />} />
                      {walletData.map((wd) => (
                        <Radar
                          key={wd.label}
                          name={wd.label}
                          dataKey={wd.label}
                          stroke={wd.color}
                          fill={wd.color}
                          fillOpacity={0.1}
                          strokeWidth={2}
                        />
                      ))}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ─── Head-to-Head Verdict ─── */}
              {verdict && (
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Trophy className="h-3 w-3 text-[#f59e0b]" />
                    <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
                      Head-to-Head Verdict
                    </span>
                  </div>
                  <div className="space-y-2">
                    {/* Leader statement */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-lg border border-[#f59e0b]/20 bg-[#f59e0b]/5 px-3 py-2.5 text-center"
                    >
                      <span className="font-mono text-[11px] font-bold text-[#f59e0b]">
                        {verdict.leader[0]} leads in {verdict.leader[1]}/{verdict.totalMetrics} metrics
                      </span>
                    </motion.div>

                    {/* Win count badges */}
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {verdict.sorted.map(([label, count], idx) => {
                        const wd = walletData.find((w) => w.label === label)
                        return (
                          <div
                            key={label}
                            className="flex items-center gap-1.5 rounded-full border px-2.5 py-1"
                            style={{
                              borderColor: `${wd?.color || '#64748b'}40`,
                              backgroundColor: idx === 0 ? `${wd?.color || '#64748b'}10` : 'transparent',
                            }}
                          >
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{
                                backgroundColor: wd?.color || '#64748b',
                                boxShadow: idx === 0 ? `0 0 6px ${wd?.color || '#64748b'}60` : 'none',
                              }}
                            />
                            <span
                              className="font-mono text-[10px] font-bold"
                              style={{ color: wd?.color || '#94a3b8' }}
                            >
                              {label}
                            </span>
                            <span className="font-mono text-[9px] text-[#64748b]">
                              {count} win{count !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Strengths cards */}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                      {walletData.map((wd) => {
                        const strengths = verdict.strengths[wd.label] || []
                        return (
                          <div
                            key={wd.label}
                            className="rounded-md border border-[#1e293b]/40 bg-[#0a0e17]/40 px-2.5 py-2"
                          >
                            <div className="mb-1 flex items-center gap-1.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: wd.color,
                                  boxShadow: `0 0 4px ${wd.color}40`,
                                }}
                              />
                              <span
                                className="font-mono text-[10px] font-bold"
                                style={{ color: wd.color }}
                              >
                                {wd.label}
                              </span>
                            </div>
                            {strengths.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {strengths.map((s) => (
                                  <span
                                    key={s}
                                    className="rounded-sm px-1.5 py-0.5 text-[8px] font-mono"
                                    style={{
                                      backgroundColor: `${wd.color}15`,
                                      color: wd.color,
                                      border: `1px solid ${wd.color}30`,
                                    }}
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[9px] text-[#64748b] italic">No leading metrics</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 text-[#64748b]"
            >
              <GitCompare className="mb-2 h-8 w-8 opacity-20" />
              <p className="text-xs">Select at least 2 wallets to compare</p>
              <p className="mt-1 text-[10px] text-[#64748b]/60">
                Use the dropdowns above to pick wallets
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
