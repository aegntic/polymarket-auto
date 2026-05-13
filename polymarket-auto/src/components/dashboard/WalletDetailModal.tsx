'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Copy,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Clock,
  Shield,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import type { Wallet, Trade } from '@/lib/store'

interface WalletDetailModalProps {
  wallet: Wallet
  onClose: () => void
}

function generateMockPnlData(totalPnl: number) {
  const points: { day: string; pnl: number }[] = []
  const base = 0
  const numPoints = 30
  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1)
    const noise = (Math.sin(i * 1.2) * 0.15 + Math.cos(i * 0.8) * 0.1) * totalPnl * 0.3
    const value = base + totalPnl * progress * (0.7 + Math.random() * 0.3) + noise
    points.push({
      day: `D${i + 1}`,
      pnl: parseFloat(value.toFixed(2)),
    })
  }
  // Ensure last point matches totalPnl
  points[points.length - 1].pnl = totalPnl
  return points
}

function EdgeGauge({ score }: { score: number }) {
  const percent = Math.min(score * 100, 100)
  const color = percent >= 70 ? '#00ff41' : percent >= 40 ? '#f59e0b' : '#ef4444'

  // Semicircle gauge
  const radius = 60
  const strokeWidth = 10
  const circumference = Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="140" height="80" viewBox="0 0 140 80">
        {/* Background semicircle */}
        <path
          d="M 10 75 A 60 60 0 0 1 130 75"
          fill="none"
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Filled semicircle */}
        <path
          d="M 10 75 A 60 60 0 0 1 130 75"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        {/* Score text */}
        <text
          x="70"
          y="65"
          textAnchor="middle"
          fill={color}
          fontSize="18"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {score.toFixed(2)}
        </text>
        <text
          x="70"
          y="78"
          textAnchor="middle"
          fill="#64748b"
          fontSize="8"
          fontFamily="monospace"
        >
          EDGE SCORE
        </text>
      </svg>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = '#00ff41',
}: {
  icon: React.ElementType
  label: string
  value: string
  subValue?: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#1e293b] bg-[#0a0e17]/60 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0" style={{ color }} />
      <div>
        <div className="text-[9px] text-[#64748b] uppercase tracking-wider">{label}</div>
        <div className="font-mono text-sm font-bold" style={{ color }}>
          {value}
        </div>
        {subValue && <div className="text-[8px] text-[#64748b]">{subValue}</div>}
      </div>
    </div>
  )
}

export function WalletDetailModal({ wallet, onClose }: WalletDetailModalProps) {
  const [copied, setCopied] = useState(false)

  const { data: trades, isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ['trades'],
    queryFn: () => fetch('/api/trades').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const walletTrades = useMemo(() => {
    if (!trades) return []
    return trades
      .filter((t) => t.walletId === wallet.id)
      .slice(0, 10)
  }, [trades, wallet.id])

  const pnlData = useMemo(() => generateMockPnlData(wallet.totalPnl), [wallet.totalPnl])

  // Edge Analysis calculations
  const marketAvgWinRate = 0.52
  const kellyOptimal = wallet.edgeScore * 0.25
  const timingScore = wallet.isEdgeTrader ? 'Pre-event (Early)' : 'Post-event (Reactive)'

  const winTrades = walletTrades.filter((t) => (t.pnl ?? 0) > 0)
  const lossTrades = walletTrades.filter((t) => (t.pnl ?? 0) < 0)
  const avgWin = winTrades.length > 0
    ? winTrades.reduce((s, t) => s + (t.pnl ?? 0), 0) / winTrades.length
    : 0
  const avgLoss = lossTrades.length > 0
    ? Math.abs(lossTrades.reduce((s, t) => s + (t.pnl ?? 0), 0) / lossTrades.length)
    : 1

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl border-[#1e293b] bg-[#0f1724]/95 backdrop-blur-xl p-0 gap-0 overflow-hidden sm:max-w-2xl">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <DialogHeader className="border-b border-[#1e293b] px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DialogTitle className="font-mono text-base font-bold text-[#e2e8f0]">
                    Wallet Profile
                  </DialogTitle>
                  {wallet.isEdgeTrader && (
                    <Badge className="bg-[#00ff41]/15 px-2 text-[10px] font-bold text-[#00ff41] border-[#00ff41]/30 hover:bg-[#00ff41]/20">
                      EDGE TRADER
                    </Badge>
                  )}
                </div>
              </div>
              <DialogDescription className="sr-only">
                Detailed profile and trade history for wallet {wallet.address}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[70vh]">
              <div className="p-6 space-y-5">
                {/* Wallet Address + Label */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#94a3b8] break-all">
                      {wallet.address}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="shrink-0 rounded-md border border-[#1e293b] bg-[#0a0e17]/60 p-1.5 text-[#64748b] transition-colors hover:text-[#00ff41] hover:border-[#00ff41]/30"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    {copied && (
                      <span className="text-[10px] text-[#00ff41] animate-pulse">Copied!</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#64748b]">Label:</span>
                    <span className="font-mono text-sm text-[#e2e8f0]">
                      {wallet.label || 'Unnamed Wallet'}
                    </span>
                  </div>
                </div>

                {/* Edge Score Gauge */}
                <div className="flex items-center justify-center rounded-lg border border-[#1e293b] bg-[#0a0e17]/40 py-3">
                  <EdgeGauge score={wallet.edgeScore} />
                </div>

                {/* Key Stats Grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatCard
                    icon={Target}
                    label="Win Rate"
                    value={`${(wallet.winRate * 100).toFixed(1)}%`}
                    color={wallet.winRate >= 0.6 ? '#00ff41' : wallet.winRate >= 0.5 ? '#f59e0b' : '#ef4444'}
                  />
                  <StatCard
                    icon={wallet.totalPnl >= 0 ? TrendingUp : TrendingDown}
                    label="Total PnL"
                    value={`${wallet.totalPnl >= 0 ? '+' : ''}$${Math.abs(wallet.totalPnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    color={wallet.totalPnl >= 0 ? '#00ff41' : '#ef4444'}
                  />
                  <StatCard
                    icon={Activity}
                    label="Total Trades"
                    value={wallet.totalTrades.toString()}
                    color="#22d3ee"
                  />
                  <StatCard
                    icon={BarChart3}
                    label="Avg Position"
                    value={`$${wallet.avgPositionSize.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    color="#a78bfa"
                  />
                </div>

                <Separator className="bg-[#1e293b]" />

                {/* Performance Mini Chart */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                    <Zap className="h-3 w-3 text-[#00ff41]" />
                    Performance (PnL Over Time)
                  </h3>
                  <div className="h-[120px] w-full rounded-lg border border-[#1e293b] bg-[#0a0e17]/40 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={pnlData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={wallet.totalPnl >= 0 ? '#00ff41' : '#ef4444'} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={wallet.totalPnl >= 0 ? '#00ff41' : '#ef4444'} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="day"
                          stroke="#334155"
                          tick={{ fill: '#64748b', fontSize: 8 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={(val) =>
                            Math.abs(val) >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val.toFixed(0)}`
                          }
                          stroke="#334155"
                          tick={{ fill: '#64748b', fontSize: 8 }}
                          tickLine={false}
                          axisLine={false}
                          width={45}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#0f1724',
                            border: '1px solid #1e293b',
                            borderRadius: '6px',
                            fontSize: '10px',
                            color: '#e2e8f0',
                          }}
                          formatter={(value: number) => [
                            `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            'PnL',
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="pnl"
                          stroke={wallet.totalPnl >= 0 ? '#00ff41' : '#ef4444'}
                          strokeWidth={1.5}
                          fill="url(#pnlGradient)"
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <Separator className="bg-[#1e293b]" />

                {/* Recent Trades Table */}
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                    <Clock className="h-3 w-3 text-cyan-400" />
                    Recent Trades
                  </h3>
                  {tradesLoading ? (
                    <div className="flex items-center justify-center py-6 text-xs text-[#64748b]">
                      Loading trades...
                    </div>
                  ) : walletTrades.length === 0 ? (
                    <div className="flex items-center justify-center py-6 text-xs text-[#64748b]">
                      No trades found for this wallet
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/40 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#1e293b] hover:bg-transparent">
                            <TableHead className="text-[9px] text-[#64748b] uppercase tracking-wider h-8">Market</TableHead>
                            <TableHead className="text-[9px] text-[#64748b] uppercase tracking-wider h-8">Side</TableHead>
                            <TableHead className="text-[9px] text-[#64748b] uppercase tracking-wider h-8 text-right">Size</TableHead>
                            <TableHead className="text-[9px] text-[#64748b] uppercase tracking-wider h-8 text-right">Price</TableHead>
                            <TableHead className="text-[9px] text-[#64748b] uppercase tracking-wider h-8 text-right">PnL</TableHead>
                            <TableHead className="text-[9px] text-[#64748b] uppercase tracking-wider h-8 text-right">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {walletTrades.map((trade) => (
                            <TableRow
                              key={trade.id}
                              className="border-[#1e293b]/50 hover:bg-[#1e293b]/20"
                            >
                              <TableCell className="font-mono text-[10px] text-[#e2e8f0] max-w-[120px] truncate py-1.5">
                                {trade.market?.title || trade.marketId.slice(0, 8)}
                              </TableCell>
                              <TableCell className="py-1.5">
                                <span
                                  className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-bold ${
                                    trade.side === 'YES'
                                      ? 'text-[#00ff41]'
                                      : 'text-[#ef4444]'
                                  }`}
                                >
                                  {trade.side === 'YES' ? (
                                    <ArrowUpRight className="h-2.5 w-2.5" />
                                  ) : (
                                    <ArrowDownRight className="h-2.5 w-2.5" />
                                  )}
                                  {trade.side}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-[10px] text-[#94a3b8] text-right py-1.5">
                                ${trade.size.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell className="font-mono text-[10px] text-[#94a3b8] text-right py-1.5">
                                {trade.price.toFixed(2)}c
                              </TableCell>
                              <TableCell
                                className={`font-mono text-[10px] font-bold text-right py-1.5 ${
                                  (trade.pnl ?? 0) > 0
                                    ? 'text-[#00ff41]'
                                    : (trade.pnl ?? 0) < 0
                                      ? 'text-[#ef4444]'
                                      : 'text-[#64748b]'
                                }`}
                              >
                                {trade.pnl != null
                                  ? `${trade.pnl >= 0 ? '+' : ''}$${Math.abs(trade.pnl).toFixed(2)}`
                                  : '—'}
                              </TableCell>
                              <TableCell className="font-mono text-[10px] text-[#64748b] text-right py-1.5">
                                {new Date(trade.createdAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <Separator className="bg-[#1e293b]" />

                {/* Edge Analysis Section */}
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#94a3b8]">
                    <Shield className="h-3 w-3 text-[#f59e0b]" />
                    Edge Analysis
                  </h3>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {/* Win Rate vs Market */}
                    <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/40 p-3 space-y-1.5">
                      <div className="text-[9px] text-[#64748b] uppercase tracking-wider">
                        Win Rate vs Market Avg
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span
                          className="font-mono text-sm font-bold"
                          style={{
                            color:
                              wallet.winRate > marketAvgWinRate
                                ? '#00ff41'
                                : wallet.winRate >= marketAvgWinRate
                                  ? '#f59e0b'
                                  : '#ef4444',
                          }}
                        >
                          {(wallet.winRate * 100).toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-[#64748b]">vs</span>
                        <span className="font-mono text-sm text-[#64748b]">
                          {(marketAvgWinRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1e293b]">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(wallet.winRate * 100, 100)}%`,
                            backgroundColor:
                              wallet.winRate > marketAvgWinRate ? '#00ff41' : '#ef4444',
                          }}
                        />
                      </div>
                      <div className="text-[8px] text-[#64748b]">
                        {wallet.winRate > marketAvgWinRate
                          ? `${((wallet.winRate - marketAvgWinRate) * 100).toFixed(1)}pp above market`
                          : `${((marketAvgWinRate - wallet.winRate) * 100).toFixed(1)}pp below market`}
                      </div>
                    </div>

                    {/* Position Sizing vs Kelly */}
                    <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/40 p-3 space-y-1.5">
                      <div className="text-[9px] text-[#64748b] uppercase tracking-wider">
                        Position Sizing vs Kelly
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-sm font-bold text-[#a78bfa]">
                          ${wallet.avgPositionSize.toFixed(0)}
                        </span>
                        <span className="text-[10px] text-[#64748b]">vs</span>
                        <span className="font-mono text-sm text-[#64748b]">
                          ${(kellyOptimal * 1000).toFixed(0)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1e293b]">
                        <div
                          className="h-full rounded-full bg-[#a78bfa] transition-all"
                          style={{
                            width: `${Math.min((wallet.avgPositionSize / Math.max(kellyOptimal * 1000, 1)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <div className="text-[8px] text-[#64748b]">
                        {wallet.avgPositionSize > kellyOptimal * 1000
                          ? 'Over-sized vs Kelly'
                          : 'Under-sized vs Kelly'}
                      </div>
                    </div>

                    {/* Timing Analysis */}
                    <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/40 p-3 space-y-1.5">
                      <div className="text-[9px] text-[#64748b] uppercase tracking-wider">
                        Timing Analysis
                      </div>
                      <div className="font-mono text-sm font-bold text-[#22d3ee]">
                        {timingScore}
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1e293b]">
                        <div
                          className="h-full rounded-full bg-[#22d3ee] transition-all"
                          style={{
                            width: wallet.isEdgeTrader ? '85%' : '45%',
                          }}
                        />
                      </div>
                      <div className="text-[8px] text-[#64748b]">
                        {wallet.isEdgeTrader
                          ? 'Tends to enter before market moves'
                          : 'Tends to follow market momentum'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Last Active */}
                <div className="flex items-center justify-between text-[10px] text-[#64748b] pt-2 border-t border-[#1e293b]/50">
                  <span>
                    First seen: {wallet.firstSeen ? new Date(wallet.firstSeen).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown'}
                  </span>
                  <span>
                    Last active: {wallet.lastActive ? new Date(wallet.lastActive).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown'}
                  </span>
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
