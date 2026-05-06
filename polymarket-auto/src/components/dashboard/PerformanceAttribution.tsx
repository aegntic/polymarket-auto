'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PieChart as PieChartIcon,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { Trade } from '@/lib/store'

/* ─── Category Configuration ─── */
const CATEGORY_COLORS: Record<string, string> = {
  crypto: '#00ff41',
  economics: '#f59e0b',
  politics: '#a855f7',
  science: '#22d3ee',
  sports: '#f97316',
}

const CATEGORY_LABELS: Record<string, string> = {
  crypto: 'Crypto',
  economics: 'Economics',
  politics: 'Politics',
  science: 'Science',
  sports: 'Sports',
}

/* ─── Types ─── */
interface CategoryAttribution {
  name: string
  key: string
  value: number // absolute P&L for chart sizing
  pnl: number // actual P&L (signed)
  count: number
  wins: number
  winRate: number
  color: string
  percentage: number // contribution to total absolute P&L
}

/* ─── Custom Tooltip for Donut ─── */
function AttributionTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: CategoryAttribution }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0].payload
  const isPositive = data.pnl >= 0

  return (
    <div
      className="px-3 py-2 shadow-xl"
      style={{
        backgroundColor: '#0f1724',
        border: '1px solid #1e293b',
        borderRadius: '6px',
        fontSize: '10px',
        color: '#e2e8f0',
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: data.color }}
        />
        <span className="font-semibold" style={{ color: data.color }}>
          {data.name}
        </span>
      </div>
      <div className="text-[#94a3b8]">
        P&L:{' '}
        <span
          className="font-mono font-bold"
          style={{ color: isPositive ? '#00ff41' : '#ef4444' }}
        >
          {isPositive ? '+' : ''}
          {data.pnl.toFixed(2)}
        </span>
      </div>
      <div className="text-[#94a3b8]">
        Contribution:{' '}
        <span className="font-mono font-bold text-[#e2e8f0]">
          {data.percentage.toFixed(1)}%
        </span>
      </div>
      <div className="text-[#94a3b8]">
        Trades:{' '}
        <span className="font-mono font-bold text-[#e2e8f0]">
          {data.count}
        </span>
      </div>
      <div className="text-[#94a3b8]">
        Win Rate:{' '}
        <span className="font-mono font-bold text-[#e2e8f0]">
          {(data.winRate * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

/* ─── Custom Legend ─── */
function AttributionLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>
}) {
  if (!payload || payload.length === 0) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      {payload.map((entry, index) => (
        <div key={`legend-${index}`} className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="font-mono text-[9px] text-[#94a3b8]">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─── Main Component ─── */
export function PerformanceAttribution() {
  const { data: trades, isLoading, error } = useQuery<Trade[]>({
    queryKey: ['trades'],
    queryFn: () => fetch('/api/trades').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const { categoryData, totalPnl, bestCategory, worstCategory, mostTradedCategory, positiveCategoriesCount } =
    useMemo(() => {
      if (!trades || trades.length === 0) {
        return {
          categoryData: [],
          totalPnl: 0,
          bestCategory: null,
          worstCategory: null,
          mostTradedCategory: null,
          positiveCategoriesCount: 0,
        }
      }

      // Group trades by market category and aggregate P&L
      const categoryMap: Record<
        string,
        { totalPnl: number; count: number; wins: number }
      > = {}

      for (const trade of trades) {
        const category = trade.market?.category ?? 'unknown'
        if (!categoryMap[category]) {
          categoryMap[category] = { totalPnl: 0, count: 0, wins: 0 }
        }
        categoryMap[category].count += 1
        if (trade.pnl !== null && trade.pnl !== undefined) {
          categoryMap[category].totalPnl += trade.pnl
          if (trade.pnl > 0) {
            categoryMap[category].wins += 1
          }
        }
      }

      const totalAbsPnl = Object.values(categoryMap).reduce(
        (sum, c) => sum + Math.abs(c.totalPnl),
        0
      )
      const totalPnl = Object.values(categoryMap).reduce(
        (sum, c) => sum + c.totalPnl,
        0
      )

      // Build chart data sorted by P&L contribution (absolute)
      const categoryData: CategoryAttribution[] = Object.entries(categoryMap)
        .sort(([, a], [, b]) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl))
        .map(([category, data]) => ({
          name: CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1),
          key: category,
          value: Math.abs(data.totalPnl), // absolute for chart sizing
          pnl: data.totalPnl, // signed for display
          count: data.count,
          wins: data.wins,
          winRate: data.count > 0 ? data.wins / data.count : 0,
          color: CATEGORY_COLORS[category] ?? '#64748b',
          percentage:
            totalAbsPnl > 0 ? (Math.abs(data.totalPnl) / totalAbsPnl) * 100 : 0,
        }))

      // Summary stats
      let bestCategory: CategoryAttribution | null = null
      let worstCategory: CategoryAttribution | null = null
      let mostTradedCategory: CategoryAttribution | null = null
      let positiveCategoriesCount = 0

      for (const cat of categoryData) {
        if (!bestCategory || cat.pnl > bestCategory.pnl) {
          bestCategory = cat
        }
        if (!worstCategory || cat.pnl < worstCategory.pnl) {
          worstCategory = cat
        }
        if (!mostTradedCategory || cat.count > mostTradedCategory.count) {
          mostTradedCategory = cat
        }
        if (cat.pnl > 0) {
          positiveCategoriesCount++
        }
      }

      return {
        categoryData,
        totalPnl,
        bestCategory,
        worstCategory,
        mostTradedCategory,
        positiveCategoriesCount,
      }
    }, [trades])

  /* ─── Loading State ─── */
  if (isLoading) {
    return (
      <Card className="card-accent-green border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <PieChartIcon className="h-4 w-4 text-[#00ff41]" />
            PERFORMANCE ATTRIBUTION
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <Skeleton className="h-[180px] w-[180px] rounded-full bg-[#1e293b]/50" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full bg-[#1e293b]/50" />
            <Skeleton className="h-4 w-3/4 bg-[#1e293b]/50" />
            <Skeleton className="h-4 w-5/6 bg-[#1e293b]/50" />
          </div>
        </CardContent>
      </Card>
    )
  }

  /* ─── Error / Empty State ─── */
  if (error || categoryData.length === 0) {
    return (
      <Card className="card-accent-green border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <PieChartIcon className="h-4 w-4 text-[#00ff41]" />
            PERFORMANCE ATTRIBUTION
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-xs text-[#64748b]">
            No P&L attribution data available
          </p>
        </CardContent>
      </Card>
    )
  }

  /* ─── Render ─── */
  return (
    <Card className="card-accent-green border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <PieChartIcon className="h-4 w-4 text-[#00ff41]" />
            PERFORMANCE ATTRIBUTION
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[#64748b]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00ff41] animate-pulse" />
            {categoryData.length} categories
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ─── Donut Chart ─── */}
        <motion.div
          className="flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="relative h-[180px] w-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<AttributionTooltip />} />
                <Legend content={<AttributionLegend />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text: Total P&L */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[9px] uppercase tracking-wider text-[#64748b]">
                Total P&L
              </span>
              <span
                className="font-mono text-base font-bold"
                style={{ color: totalPnl >= 0 ? '#00ff41' : '#ef4444' }}
              >
                {totalPnl >= 0 ? '+' : ''}
                {totalPnl.toFixed(2)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ─── Category Breakdown List ─── */}
        <ScrollArea className="max-h-[260px]">
          <motion.div
            className="space-y-1.5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            {categoryData.map((cat, index) => {
              const isPositive = cat.pnl >= 0
              return (
                <motion.div
                  key={cat.key}
                  className="rounded-md border border-[#1e293b]/50 bg-[#0a0e17]/40 px-3 py-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.06, duration: 0.3 }}
                >
                  {/* Row 1: Category badge + P&L */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        className="h-5 border px-2 text-[10px] font-bold"
                        style={{
                          color: cat.color,
                          backgroundColor: `${cat.color}10`,
                          borderColor: `${cat.color}30`,
                        }}
                      >
                        {cat.name}
                      </Badge>
                      {isPositive ? (
                        <ArrowUpRight className="h-3 w-3 text-[#00ff41]" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-[#ef4444]" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isPositive ? (
                        <TrendingUp className="h-3 w-3 text-[#00ff41]" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-[#ef4444]" />
                      )}
                      <span
                        className="font-mono text-xs font-bold"
                        style={{ color: isPositive ? '#00ff41' : '#ef4444' }}
                      >
                        {isPositive ? '+' : ''}
                        {cat.pnl.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Trades + Win Rate */}
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className="font-mono text-[#64748b]">
                      {cat.count} trade{cat.count !== 1 ? 's' : ''}
                    </span>
                    <span className="font-mono text-[#64748b]">
                      WR:{' '}
                      <span
                        className="font-bold"
                        style={{
                          color:
                            cat.winRate >= 0.6
                              ? '#00ff41'
                              : cat.winRate >= 0.4
                                ? '#f59e0b'
                                : '#ef4444',
                        }}
                      >
                        {(cat.winRate * 100).toFixed(0)}%
                      </span>
                    </span>
                  </div>

                  {/* Row 3: P&L Contribution Bar */}
                  <div className="mt-1.5">
                    <div className="h-1 w-full overflow-hidden rounded-full bg-[#1e293b]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: cat.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.percentage}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="mt-0.5 text-right font-mono text-[9px] text-[#64748b]">
                      {cat.percentage.toFixed(1)}% contribution
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </ScrollArea>

        {/* ─── Summary Stats ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="grid grid-cols-2 gap-2"
        >
          {/* Best Performing */}
          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3 text-[#00ff41]" />
              <span className="text-[9px] uppercase tracking-wider text-[#64748b]">
                Best
              </span>
            </div>
            {bestCategory && (
              <>
                <div
                  className="truncate font-mono text-[10px] font-bold"
                  style={{ color: bestCategory.color }}
                  title={bestCategory.name}
                >
                  {bestCategory.name}
                </div>
                <div className="font-mono text-[10px] font-bold text-[#00ff41]">
                  +{bestCategory.pnl.toFixed(2)}
                </div>
              </>
            )}
          </div>

          {/* Worst Performing */}
          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingDown className="h-3 w-3 text-[#ef4444]" />
              <span className="text-[9px] uppercase tracking-wider text-[#64748b]">
                Worst
              </span>
            </div>
            {worstCategory && (
              <>
                <div
                  className="truncate font-mono text-[10px] font-bold"
                  style={{ color: worstCategory.color }}
                  title={worstCategory.name}
                >
                  {worstCategory.name}
                </div>
                <div className="font-mono text-[10px] font-bold text-[#ef4444]">
                  {worstCategory.pnl >= 0 ? '+' : ''}
                  {worstCategory.pnl.toFixed(2)}
                </div>
              </>
            )}
          </div>

          {/* Most Traded */}
          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1">
              <PieChartIcon className="h-3 w-3 text-[#22d3ee]" />
              <span className="text-[9px] uppercase tracking-wider text-[#64748b]">
                Most Traded
              </span>
            </div>
            {mostTradedCategory && (
              <>
                <div
                  className="truncate font-mono text-[10px] font-bold"
                  style={{ color: mostTradedCategory.color }}
                  title={mostTradedCategory.name}
                >
                  {mostTradedCategory.name}
                </div>
                <div className="font-mono text-[10px] font-bold text-[#22d3ee]">
                  {mostTradedCategory.count} trades
                </div>
              </>
            )}
          </div>

          {/* Positive Categories */}
          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-[#00ff41]" />
              <span className="text-[9px] uppercase tracking-wider text-[#64748b]">
                Profitable
              </span>
            </div>
            <div className="font-mono text-xs font-bold text-[#00ff41]">
              {positiveCategoriesCount}/{categoryData.length}
            </div>
            <div className="font-mono text-[9px] text-[#64748b]">
              {positiveCategoriesCount === categoryData.length
                ? 'All positive'
                : `${categoryData.length - positiveCategoriesCount} negative`}
            </div>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  )
}
