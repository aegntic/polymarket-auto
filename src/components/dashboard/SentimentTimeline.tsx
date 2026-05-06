'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import { HeartPulse, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { NewsEvent } from '@/lib/store'

/* ─── Category color mapping ─── */
const CATEGORY_COLORS: Record<string, string> = {
  crypto: '#00ff41',
  economics: '#f59e0b',
  politics: '#a855f7',
  science: '#22d3ee',
}

const CATEGORY_BADGE_STYLES: Record<string, string> = {
  crypto: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  economics: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  politics: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  science: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
}

const CATEGORY_LINE_COLORS: Record<string, string> = {
  crypto: '#00ff41',
  economics: '#f59e0b',
  politics: '#a855f7',
  science: '#22d3ee',
}

/* ─── Time formatting helper ─── */
function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return '--:--'
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

/* ─── Custom tooltip ─── */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string; payload: { title?: string; [key: string]: unknown } }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0f1724]/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <div className="mb-1.5 text-[10px] font-mono text-[#64748b]">{label}</div>
      <div className="space-y-1">
        {payload.map((entry) => {
          const catLabel = entry.dataKey === 'average'
            ? 'AVG'
            : entry.dataKey.charAt(0).toUpperCase() + entry.dataKey.slice(1)
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-[10px] font-mono text-[#94a3b8]">{catLabel}</span>
              </div>
              <span
                className="text-[10px] font-mono font-bold"
                style={{ color: entry.color }}
              >
                {(entry.value > 0 ? '+' : '') + entry.value.toFixed(2)}
              </span>
            </div>
          )
        })}
      </div>
      {/* Show article title for the first data point */}
      {payload[0]?.payload?.title && (
        <div className="mt-1.5 border-t border-[#1e293b] pt-1.5">
          <p className="max-w-[200px] truncate text-[9px] text-[#cbd5e1]">
            {payload[0].payload.title as string}
          </p>
        </div>
      )}
    </div>
  )
}

/* ─── Custom legend ─── */
function CustomLegend({
  activeCategories,
  onToggle,
}: {
  activeCategories: Record<string, boolean>
  onToggle: (cat: string) => void
}) {
  const categories = ['crypto', 'economics', 'politics', 'science']

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onToggle(cat)}
          className={`rounded-full border px-2 py-0.5 text-[9px] font-mono font-medium capitalize transition-all ${
            activeCategories[cat]
              ? CATEGORY_BADGE_STYLES[cat] || 'border-[#1e293b] bg-[#1e293b]/50 text-[#94a3b8]'
              : 'border-[#1e293b]/40 bg-transparent text-[#64748b] line-through opacity-50'
          }`}
        >
          {cat}
        </button>
      ))}
      <button
        onClick={() => onToggle('average')}
        className={`rounded-full border px-2 py-0.5 text-[9px] font-mono font-medium transition-all ${
          activeCategories['average']
            ? 'border-white/30 bg-white/10 text-white'
            : 'border-[#1e293b]/40 bg-transparent text-[#64748b] line-through opacity-50'
        }`}
      >
        AVG
      </button>
    </div>
  )
}

/* ─── Sentiment icon helper ─── */
function SentimentIcon({ value }: { value: number }) {
  if (value > 0.1) return <TrendingUp className="h-3 w-3" style={{ color: '#00ff41' }} />
  if (value < -0.1) return <TrendingDown className="h-3 w-3" style={{ color: '#ef4444' }} />
  return <Minus className="h-3 w-3" style={{ color: '#f59e0b' }} />
}

/* ─── Main Component ─── */
export function SentimentTimeline() {
  const [activeCategories, setActiveCategories] = useState<Record<string, boolean>>({
    crypto: true,
    economics: true,
    politics: true,
    science: true,
    average: true,
  })

  const { data: news, isLoading, error } = useQuery<NewsEvent[]>({
    queryKey: ['news'],
    queryFn: () => fetch('/api/news').then((r) => r.json()),
    refetchInterval: 30000,
  })

  // Build chart data: group news by time, one data point per article
  const { chartData, categoryStats, overallStats } = useMemo(() => {
    if (!news || news.length === 0) {
      return {
        chartData: [],
        categoryStats: {} as Record<string, { avg: number; count: number }>,
        overallStats: {
          currentSentiment: 0,
          trend: 'stable' as 'improving' | 'declining' | 'stable',
          mostPositive: '-',
          mostNegative: '-',
          totalItems: 0,
        },
      }
    }

    // Sort by publishedAt ascending for the timeline
    const sorted = [...news].sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    )

    // Group by category for stats
    const catMap: Record<string, { sentiments: number[]; count: number }> = {}
    for (const item of sorted) {
      if (!catMap[item.category]) {
        catMap[item.category] = { sentiments: [], count: 0 }
      }
      catMap[item.category].sentiments.push(item.sentiment)
      catMap[item.category].count++
    }

    const catStats: Record<string, { avg: number; count: number }> = {}
    for (const [cat, data] of Object.entries(catMap)) {
      catStats[cat] = {
        avg: data.sentiments.reduce((s, v) => s + v, 0) / data.sentiments.length,
        count: data.count,
      }
    }

    // Build chart data points — one per article, showing sentiment per category
    // We'll accumulate category sentiments per time bucket
    const timeBuckets: Record<string, {
      time: string
      fullDate: string
      title: string
      crypto: number | null
      economics: number | null
      politics: number | null
      science: number | null
      average: number
      _allSentiments: number[]
    }> = {}

    for (const item of sorted) {
      const timeKey = formatTime(item.publishedAt)
      const fullDateKey = `${formatDate(item.publishedAt)} ${timeKey}`

      if (!timeBuckets[fullDateKey]) {
        timeBuckets[fullDateKey] = {
          time: timeKey,
          fullDate: fullDateKey,
          title: item.title,
          crypto: null,
          economics: null,
          politics: null,
          science: null,
          average: 0,
          _allSentiments: [],
        }
      }

      const bucket = timeBuckets[fullDateKey]
      if (item.category in CATEGORY_COLORS) {
        bucket[item.category as keyof typeof CATEGORY_COLORS] = item.sentiment
      }
      bucket._allSentiments.push(item.sentiment)
    }

    // Compute averages and build final chart data
    const data = Object.values(timeBuckets).map((bucket) => ({
      time: bucket.time,
      fullDate: bucket.fullDate,
      title: bucket.title,
      crypto: bucket.crypto,
      economics: bucket.economics,
      politics: bucket.politics,
      science: bucket.science,
      average:
        bucket._allSentiments.length > 0
          ? bucket._allSentiments.reduce((s, v) => s + v, 0) / bucket._allSentiments.length
          : 0,
    }))

    // Overall stats
    const allSentiments = sorted.map((n) => n.sentiment)
    const latestAvg =
      data.length > 0 ? data[data.length - 1].average : 0

    // Trend: compare average of last 3 vs first 3
    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    if (data.length >= 3) {
      const first3 = data.slice(0, Math.min(3, data.length))
      const last3 = data.slice(-Math.min(3, data.length))
      const firstAvg = first3.reduce((s, d) => s + d.average, 0) / first3.length
      const lastAvg = last3.reduce((s, d) => s + d.average, 0) / last3.length
      const diff = lastAvg - firstAvg
      if (diff > 0.05) trend = 'improving'
      else if (diff < -0.05) trend = 'declining'
    }

    // Most positive / negative category
    let mostPositive = '-'
    let mostNegative = '-'
    let maxAvg = -Infinity
    let minAvg = Infinity
    for (const [cat, stats] of Object.entries(catStats)) {
      if (stats.avg > maxAvg) {
        maxAvg = stats.avg
        mostPositive = cat
      }
      if (stats.avg < minAvg) {
        minAvg = stats.avg
        mostNegative = cat
      }
    }

    return {
      chartData: data,
      categoryStats: catStats,
      overallStats: {
        currentSentiment: latestAvg,
        trend,
        mostPositive,
        mostNegative,
        totalItems: sorted.length,
      },
    }
  }, [news])

  const toggleCategory = (cat: string) => {
    setActiveCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }))
  }

  const getSentimentColor = (value: number): string => {
    if (value > 0.1) return '#00ff41'
    if (value < -0.1) return '#ef4444'
    return '#f59e0b'
  }

  const getTrendIcon = () => {
    if (overallStats.trend === 'improving')
      return <TrendingUp className="h-3 w-3 text-[#00ff41]" />
    if (overallStats.trend === 'declining')
      return <TrendingDown className="h-3 w-3 text-[#ef4444]" />
    return <Minus className="h-3 w-3 text-[#f59e0b]" />
  }

  const getTrendLabel = () => {
    if (overallStats.trend === 'improving') return 'Improving'
    if (overallStats.trend === 'declining') return 'Declining'
    return 'Stable'
  }

  const getTrendColor = () => {
    if (overallStats.trend === 'improving') return 'text-[#00ff41]'
    if (overallStats.trend === 'declining') return 'text-[#ef4444]'
    return 'text-[#f59e0b]'
  }

  if (error) {
    return (
      <Card className="card-accent-amber border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <HeartPulse className="h-4 w-4 text-[#f59e0b]" />
            SENTIMENT TIMELINE
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load sentiment data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-amber border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <HeartPulse className="h-4 w-4 text-[#f59e0b]" />
          SENTIMENT TIMELINE
          <span className="ml-auto text-[10px] font-mono text-[#64748b]">
            {overallStats.totalItems > 0 ? `${overallStats.totalItems} events` : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-[200px] w-full bg-[#1e293b]/50" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-16 bg-[#1e293b]/50" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 bg-[#1e293b]/50" />
              ))}
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#64748b]">
            <HeartPulse className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-xs">No sentiment data available</p>
          </div>
        ) : (
          <>
            {/* Sentiment Chart */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                >
                  <XAxis
                    dataKey="time"
                    tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#1e293b' }}
                    tickLine={{ stroke: '#1e293b' }}
                  />
                  <YAxis
                    domain={[-1, 1]}
                    tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#1e293b' }}
                    tickLine={{ stroke: '#1e293b' }}
                    ticks={[-1, -0.5, 0, 0.5, 1]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Zero reference line */}
                  <ReferenceLine
                    y={0}
                    stroke="#64748b"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />

                  {/* Category lines */}
                  {activeCategories.crypto && (
                    <Line
                      type="monotone"
                      dataKey="crypto"
                      stroke={CATEGORY_LINE_COLORS.crypto}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CATEGORY_LINE_COLORS.crypto, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: CATEGORY_LINE_COLORS.crypto, strokeWidth: 0 }}
                      connectNulls={false}
                    />
                  )}
                  {activeCategories.economics && (
                    <Line
                      type="monotone"
                      dataKey="economics"
                      stroke={CATEGORY_LINE_COLORS.economics}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CATEGORY_LINE_COLORS.economics, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: CATEGORY_LINE_COLORS.economics, strokeWidth: 0 }}
                      connectNulls={false}
                    />
                  )}
                  {activeCategories.politics && (
                    <Line
                      type="monotone"
                      dataKey="politics"
                      stroke={CATEGORY_LINE_COLORS.politics}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CATEGORY_LINE_COLORS.politics, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: CATEGORY_LINE_COLORS.politics, strokeWidth: 0 }}
                      connectNulls={false}
                    />
                  )}
                  {activeCategories.science && (
                    <Line
                      type="monotone"
                      dataKey="science"
                      stroke={CATEGORY_LINE_COLORS.science}
                      strokeWidth={2}
                      dot={{ r: 3, fill: CATEGORY_LINE_COLORS.science, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: CATEGORY_LINE_COLORS.science, strokeWidth: 0 }}
                      connectNulls={false}
                    />
                  )}
                  {activeCategories.average && (
                    <Line
                      type="monotone"
                      dataKey="average"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      dot={false}
                      activeDot={{ r: 4, fill: '#ffffff', strokeWidth: 0, opacity: 0.7 }}
                      connectNulls
                    />
                  )}

                  <Legend content={() => null} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Category Filter Toggles */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <CustomLegend
                activeCategories={activeCategories}
                onToggle={toggleCategory}
              />
            </motion.div>

            {/* Summary Stats Row */}
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="grid grid-cols-2 gap-2 sm:grid-cols-5"
            >
              {/* Current Sentiment */}
              <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
                <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
                  Sentiment
                </div>
                <div className="flex items-center justify-center gap-1">
                  <SentimentIcon value={overallStats.currentSentiment} />
                  <span
                    className="font-mono text-xs font-bold"
                    style={{ color: getSentimentColor(overallStats.currentSentiment) }}
                  >
                    {(overallStats.currentSentiment > 0 ? '+' : '') +
                      overallStats.currentSentiment.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Trend */}
              <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
                <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
                  Trend
                </div>
                <div className="flex items-center justify-center gap-1">
                  {getTrendIcon()}
                  <span className={`font-mono text-xs font-bold ${getTrendColor()}`}>
                    {getTrendLabel()}
                  </span>
                </div>
              </div>

              {/* Most Positive Category */}
              <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
                <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
                  Most Positive
                </div>
                <div className="font-mono text-xs font-bold capitalize text-[#00ff41]">
                  {overallStats.mostPositive}
                </div>
              </div>

              {/* Most Negative Category */}
              <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
                <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
                  Most Negative
                </div>
                <div className="font-mono text-xs font-bold capitalize text-[#ef4444]">
                  {overallStats.mostNegative}
                </div>
              </div>

              {/* Total News Items */}
              <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center col-span-2 sm:col-span-1">
                <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
                  Total Items
                </div>
                <div className="font-mono text-xs font-bold text-[#22d3ee]">
                  {overallStats.totalItems}
                </div>
              </div>
            </motion.div>

            {/* Category Breakdown Badges */}
            {Object.keys(categoryStats).length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="flex flex-wrap items-center gap-1.5"
              >
                <span className="text-[9px] text-[#64748b]">Categories:</span>
                {Object.entries(categoryStats).map(([cat, stats]) => (
                  <Badge
                    key={cat}
                    className={`h-5 px-2 text-[9px] font-mono ${
                      CATEGORY_BADGE_STYLES[cat] || 'border-[#1e293b] bg-[#1e293b]/50 text-[#94a3b8]'
                    }`}
                  >
                    {cat}{' '}
                    <span className="ml-1 opacity-70">
                      {(stats.avg > 0 ? '+' : '') + stats.avg.toFixed(2)}
                    </span>
                  </Badge>
                ))}
              </motion.div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
