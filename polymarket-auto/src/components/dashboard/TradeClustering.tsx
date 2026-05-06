'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Radar, TrendingUp, TrendingDown, Users, Activity, BarChart3, Target, Zap } from 'lucide-react'

/* ─── Types ─── */
interface TradeCluster {
  id: string
  startTime: string
  endTime: string
  category: 'crypto' | 'politics' | 'economics' | 'science'
  traderCount: number
  tradeCount: number
  avgPositionSize: number
  signalStrength: 'weak' | 'medium' | 'strong'
  direction: 'BULLISH' | 'BEARISH'
  marketTitles: string[]
}

/* ─── Category color mapping ─── */
const CATEGORY_COLORS: Record<string, string> = {
  crypto: '#00ff41',
  politics: '#a855f7',
  economics: '#f59e0b',
  science: '#22d3ee',
}

const CATEGORY_ICONS: Record<string, string> = {
  crypto: '₿',
  politics: '⚖',
  economics: '$',
  science: '⚛',
}

const SIGNAL_STRENGTH_STYLES: Record<string, string> = {
  strong: 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/20',
  medium: 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20',
  weak: 'bg-[#64748b]/10 text-[#64748b] border-[#64748b]/20',
}

/* ─── Seeded pseudo-random generator for stable data ─── */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

/* ─── Generate realistic cluster data ─── */
function generateClusters(refreshKey: number): TradeCluster[] {
  const rng = seededRandom(refreshKey * 7 + 42)
  const categories: TradeCluster['category'][] = ['crypto', 'politics', 'economics', 'science']
  const strengths: TradeCluster['signalStrength'][] = ['weak', 'medium', 'strong']
  const directions: TradeCluster['direction'][] = ['BULLISH', 'BEARISH']

  const cryptoMarkets = [
    'Bitcoin above $100K by Dec?',
    'ETH flips BTC market cap?',
    'SOL reaches $500?',
    'DOGE hits $1?',
    'BTC dominance above 60%?',
  ]
  const politicsMarkets = [
    '2028 Democratic nominee?',
    'Federal funding freeze reversed?',
    'Senate flips in midterms?',
    'Executive order challenged in SCOTUS?',
    'Presidential approval above 50%?',
  ]
  const economicsMarkets = [
    'Fed cuts rates in Q2?',
    'US GDP growth above 3%?',
    'Inflation below 2% by year end?',
    'Unemployment rises above 5%?',
    'Recession confirmed in 2025?',
  ]
  const scienceMarkets = [
    'AI achieves AGI by 2030?',
    'Fusion breakthrough announced?',
    'Mars mission launch date set?',
    'Quantum computing milestone?',
    'CRISPR cure approved?',
  ]

  const marketMap: Record<string, string[]> = {
    crypto: cryptoMarkets,
    politics: politicsMarkets,
    economics: economicsMarkets,
    science: scienceMarkets,
  }

  const clusterCount = 8 + Math.floor(rng() * 5) // 8-12 clusters
  const now = new Date()
  const clusters: TradeCluster[] = []

  for (let i = 0; i < clusterCount; i++) {
    const category = categories[Math.floor(rng() * categories.length)]
    const strength = strengths[Math.floor(rng() * strengths.length)]
    const direction = directions[Math.floor(rng() * directions.length)]

    // Stronger signals → more traders and trades
    const traderMultiplier = strength === 'strong' ? 3 : strength === 'medium' ? 2 : 1
    const traderCount = (1 + Math.floor(rng() * 3)) * traderMultiplier
    const tradeCount = traderCount + Math.floor(rng() * 4) * traderMultiplier
    const avgPositionSize = Math.round((50 + rng() * 450) * (strength === 'strong' ? 2 : strength === 'medium' ? 1.5 : 1))

    // Time ranges within the last few hours
    const startOffset = Math.floor(rng() * 240) // 0-240 minutes ago
    const duration = 5 + Math.floor(rng() * 40) // 5-45 minute cluster
    const startMs = now.getTime() - startOffset * 60000
    const endMs = startMs + duration * 60000

    const startTime = new Date(startMs)
    const endTime = new Date(endMs)

    // Pick 1-3 market titles
    const availableMarkets = marketMap[category]
    const marketCount = 1 + Math.floor(rng() * 3)
    const selectedMarkets: string[] = []
    for (let j = 0; j < marketCount; j++) {
      const idx = Math.floor(rng() * availableMarkets.length)
      if (!selectedMarkets.includes(availableMarkets[idx])) {
        selectedMarkets.push(availableMarkets[idx])
      }
    }

    clusters.push({
      id: `cluster-${i}-${refreshKey}`,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      category,
      traderCount,
      tradeCount,
      avgPositionSize,
      signalStrength: strength,
      direction,
      marketTitles: selectedMarkets.length > 0 ? selectedMarkets : [availableMarkets[0]],
    })
  }

  // Sort by startTime descending (most recent first)
  clusters.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  return clusters
}

/* ─── Format time ─── */
function formatTimeUTC(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    })
  } catch {
    return '--:--'
  }
}

/* ─── Timeline position calculator ─── */
function getTimePosition(dateStr: string, minTime: number, maxTime: number): number {
  const t = new Date(dateStr).getTime()
  const range = maxTime - minTime
  if (range === 0) return 50
  return ((t - minTime) / range) * 100
}

/* ─── Main Component ─── */
export function TradeClustering() {
  const [refreshKey, setRefreshKey] = useState(Date.now())
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null)
  const [highlightedCategory, setHighlightedCategory] = useState<string | null>(null)
  const clusterListRef = useRef<HTMLDivElement>(null)

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(Date.now())
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Generate stable cluster data
  const clusters = useMemo(() => generateClusters(refreshKey), [refreshKey])

  // Compute timeline range
  const timelineRange = useMemo(() => {
    if (clusters.length === 0) return { min: Date.now() - 4 * 3600000, max: Date.now() }
    const times = clusters.flatMap((c) => [new Date(c.startTime).getTime(), new Date(c.endTime).getTime()])
    const min = Math.min(...times)
    const max = Math.max(...times)
    const padding = (max - min) * 0.05
    return { min: min - padding, max: max + padding }
  }, [clusters])

  // Top 5 clusters by significance (traderCount * tradeCount * signalStrength weight)
  const topClusters = useMemo(() => {
    const strengthWeight = { weak: 1, medium: 2, strong: 3 }
    return [...clusters]
      .sort((a, b) => {
        const scoreA = a.traderCount * a.tradeCount * (strengthWeight[a.signalStrength] ?? 1)
        const scoreB = b.traderCount * b.tradeCount * (strengthWeight[b.signalStrength] ?? 1)
        return scoreB - scoreA
      })
      .slice(0, 5)
  }, [clusters])

  // Pattern stats
  const patternStats = useMemo(() => {
    const totalClusters = clusters.length
    const avgClusterSize =
      totalClusters > 0
        ? (clusters.reduce((s, c) => s + c.tradeCount, 0) / totalClusters).toFixed(1)
        : '0'

    // Most active category
    const catCounts: Record<string, number> = {}
    for (const c of clusters) {
      catCounts[c.category] = (catCounts[c.category] || 0) + 1
    }
    const mostActive = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'

    // Signal accuracy (simulated)
    const signalAccuracy = '78.3%'

    // Trending pattern
    const bullishCount = clusters.filter((c) => c.direction === 'BULLISH').length
    const bearishCount = clusters.filter((c) => c.direction === 'BEARISH').length
    const cryptoClusters = clusters.filter((c) => c.category === 'crypto')
    const trendingPattern =
      cryptoClusters.length > 0 && bullishCount > bearishCount
        ? 'Coordinated YES buying in crypto markets'
        : bearishCount > bullishCount
          ? 'Coordinated SELL pressure across markets'
          : 'Mixed signals, no clear pattern'

    return { totalClusters, avgClusterSize, mostActive, signalAccuracy, trendingPattern }
  }, [clusters])

  // Group clusters by category for timeline
  const clustersByCategory = useMemo(() => {
    const groups: Record<string, TradeCluster[]> = { crypto: [], politics: [], economics: [], science: [] }
    for (const c of clusters) {
      groups[c.category].push(c)
    }
    return groups
  }, [clusters])

  const toggleExpand = useCallback((id: string) => {
    setExpandedCluster((prev) => (prev === id ? null : id))
  }, [])

  return (
    <Card className="card-accent-amber rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-[#f59e0b]" />
            <span className="card-title-cyber">TRADE CLUSTER DETECTION</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#64748b]">Coordinated activity patterns</span>
            <Badge className="flex items-center gap-1.5 border-[#00ff41]/20 bg-[#00ff41]/10 px-2 py-0.5 text-[9px] font-mono font-bold text-[#00ff41]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff41]" />
              SCANNING
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ─── Cluster Detection Timeline ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-lg border border-[#1e293b]/40 bg-[#0a0e17]/40 p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-[#64748b]">
              Cluster Timeline
            </span>
            <span className="text-[9px] font-mono text-[#64748b]">
              {formatTimeUTC(new Date(timelineRange.min).toISOString())} — {formatTimeUTC(new Date(timelineRange.max).toISOString())} UTC
            </span>
          </div>

          {/* Timeline axis */}
          <div className="relative">
            {/* Time markers */}
            <div className="mb-1 flex justify-between">
              {Array.from({ length: 5 }).map((_, i) => {
                const t = timelineRange.min + (timelineRange.max - timelineRange.min) * (i / 4)
                return (
                  <span key={i} className="text-[8px] font-mono text-[#64748b]/60">
                    {formatTimeUTC(new Date(t).toISOString())}
                  </span>
                )
              })}
            </div>

            {/* Category rows */}
            <div className="space-y-1.5">
              {(['crypto', 'politics', 'economics', 'science'] as const).map((category) => {
                const catClusters = clustersByCategory[category]
                const isHighlighted = highlightedCategory === category
                const isDimmed = highlightedCategory !== null && !isHighlighted
                const color = CATEGORY_COLORS[category]

                return (
                  <div
                    key={category}
                    className={`relative flex items-center gap-2 transition-opacity duration-300 ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
                    onMouseEnter={() => setHighlightedCategory(category)}
                    onMouseLeave={() => setHighlightedCategory(null)}
                  >
                    {/* Category label */}
                    <div
                      className="flex w-16 shrink-0 items-center gap-1 text-[9px] font-mono font-medium uppercase"
                      style={{ color }}
                    >
                      <span className="text-[10px]">{CATEGORY_ICONS[category]}</span>
                      {category.slice(0, 4)}
                    </div>

                    {/* Timeline track */}
                    <div className="relative h-5 flex-1 rounded-sm bg-[#1e293b]/20">
                      {/* Cluster bars */}
                      {catClusters.map((cluster) => {
                        const leftPct = getTimePosition(cluster.startTime, timelineRange.min, timelineRange.max)
                        const rightPct = getTimePosition(cluster.endTime, timelineRange.min, timelineRange.max)
                        const widthPct = Math.max(rightPct - leftPct, 2)
                        const isExpanded = expandedCluster === cluster.id

                        return (
                          <motion.button
                            key={cluster.id}
                            className={`absolute top-0.5 h-3.5 cursor-pointer rounded-sm border transition-all duration-200 hover:z-10 ${
                              isExpanded
                                ? 'z-10 ring-1'
                                : ''
                            } ${cluster.signalStrength === 'strong' ? 'border-opacity-60' : 'border-opacity-30'}`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              backgroundColor: `${color}25`,
                              borderColor: `${color}${cluster.signalStrength === 'strong' ? '60' : '30'}`,
                              boxShadow: isHighlighted || isExpanded
                                ? `0 0 8px ${color}30, 0 0 16px ${color}15`
                                : 'none',
                              '--tw-ring-color': `${color}50`,
                            } as React.CSSProperties}
                            onClick={() => toggleExpand(cluster.id)}
                            whileHover={{
                              backgroundColor: `${color}40`,
                              boxShadow: `0 0 12px ${color}40, 0 0 20px ${color}20`,
                            }}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                            title={`${cluster.traderCount} traders · ${cluster.tradeCount} trades · ${cluster.signalStrength}`}
                          >
                            {/* Signal strength indicator dots inside bar */}
                            <div className="flex h-full items-center justify-center gap-0.5 px-0.5">
                              {cluster.signalStrength === 'strong' && (
                                <>
                                  <div className="h-1 w-1 rounded-full" style={{ backgroundColor: color, opacity: 0.8 }} />
                                  <div className="h-1 w-1 rounded-full" style={{ backgroundColor: color, opacity: 0.6 }} />
                                  <div className="h-1 w-1 rounded-full" style={{ backgroundColor: color, opacity: 0.4 }} />
                                </>
                              )}
                              {cluster.signalStrength === 'medium' && (
                                <>
                                  <div className="h-1 w-1 rounded-full" style={{ backgroundColor: color, opacity: 0.7 }} />
                                  <div className="h-1 w-1 rounded-full" style={{ backgroundColor: color, opacity: 0.4 }} />
                                </>
                              )}
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>

        {/* ─── Active Clusters List ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-[#64748b]">
              Active Clusters
            </span>
            <span className="text-[9px] font-mono text-[#64748b]">
              Top 5 by significance
            </span>
          </div>
          <div
            ref={clusterListRef}
            className="max-h-72 space-y-1.5 overflow-y-auto pr-1"
          >
            <AnimatePresence mode="popLayout">
              {topClusters.map((cluster, index) => {
                const color = CATEGORY_COLORS[cluster.category]
                const isExpanded = expandedCluster === cluster.id

                return (
                  <motion.div
                    key={cluster.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`group cursor-pointer rounded-lg border bg-[#0a0e17]/50 p-2.5 transition-all duration-200 ${
                      isExpanded
                        ? 'border-[#1e293b] bg-[#0f1724]/80 shadow-lg'
                        : 'border-[#1e293b]/40 hover:border-[#1e293b]/80 hover:bg-[#0f1724]/60'
                    }`}
                    onClick={() => toggleExpand(cluster.id)}
                    onMouseEnter={() => setHighlightedCategory(cluster.category)}
                    onMouseLeave={() => setHighlightedCategory(null)}
                  >
                    {/* Main row */}
                    <div className="flex items-center gap-2">
                      {/* Category icon */}
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        {CATEGORY_ICONS[cluster.category]}
                      </div>

                      {/* Time range */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#94a3b8]">
                            {formatTimeUTC(cluster.startTime)} — {formatTimeUTC(cluster.endTime)} UTC
                          </span>
                          <Badge
                            className={`h-4 px-1.5 text-[8px] font-mono font-bold ${SIGNAL_STRENGTH_STYLES[cluster.signalStrength]}`}
                          >
                            {cluster.signalStrength.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[9px] text-[#64748b]">
                            <Users className="h-2.5 w-2.5" />
                            <span className="font-mono font-medium" style={{ color }}>
                              {cluster.traderCount}
                            </span>
                            {' edge traders'}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] text-[#64748b]">
                            <Activity className="h-2.5 w-2.5" />
                            <span className="font-mono font-medium" style={{ color }}>
                              {cluster.tradeCount}
                            </span>
                            {' coordinated trades'}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] text-[#64748b]">
                            <BarChart3 className="h-2.5 w-2.5" />
                            {'Avg '}
                            <span className="font-mono font-medium" style={{ color }}>
                              ${cluster.avgPositionSize}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Direction badge */}
                      <Badge
                        className={`h-5 shrink-0 px-2 text-[9px] font-mono font-bold ${
                          cluster.direction === 'BULLISH'
                            ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/20'
                            : 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20'
                        }`}
                      >
                        {cluster.direction === 'BULLISH' ? (
                          <TrendingUp className="mr-0.5 h-2.5 w-2.5" />
                        ) : (
                          <TrendingDown className="mr-0.5 h-2.5 w-2.5" />
                        )}
                        {cluster.direction}
                      </Badge>
                    </div>

                    {/* Expanded: Market details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-1.5 border-t border-[#1e293b]/40 pt-2">
                            <div className="text-[9px] font-mono font-medium uppercase tracking-wider text-[#64748b]">
                              Affected Markets
                            </div>
                            {cluster.marketTitles.map((title, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 rounded-md border border-[#1e293b]/30 bg-[#0a0e17]/30 px-2 py-1"
                              >
                                <div
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: color }}
                                />
                                <span className="text-[10px] text-[#cbd5e1]">{title}</span>
                                <span className="ml-auto text-[9px] font-mono" style={{ color }}>
                                  {cluster.direction === 'BULLISH' ? 'YES' : 'NO'}
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center gap-3 pt-1">
                              <span className="text-[9px] text-[#64748b]">
                                Position size: <span className="font-mono font-medium text-[#94a3b8]">${cluster.avgPositionSize}</span>
                              </span>
                              <span className="text-[9px] text-[#64748b]">
                                Coordination: <span className="font-mono font-medium" style={{ color }}>
                                  {cluster.signalStrength === 'strong' ? 'HIGH' : cluster.signalStrength === 'medium' ? 'MEDIUM' : 'LOW'}
                                </span>
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ─── Pattern Stats ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-2 gap-2 sm:grid-cols-5"
        >
          {/* Total Clusters */}
          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
              Clusters (24h)
            </div>
            <div className="flex items-center justify-center gap-1">
              <Radar className="h-3 w-3 text-[#f59e0b]" />
              <span className="font-mono text-xs font-bold text-[#f59e0b]">
                {patternStats.totalClusters}
              </span>
            </div>
          </div>

          {/* Average Cluster Size */}
          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
              Avg Size
            </div>
            <div className="flex items-center justify-center gap-1">
              <BarChart3 className="h-3 w-3 text-[#22d3ee]" />
              <span className="font-mono text-xs font-bold text-[#22d3ee]">
                {patternStats.avgClusterSize}
              </span>
            </div>
          </div>

          {/* Most Active Category */}
          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
              Most Active
            </div>
            <span
              className="font-mono text-xs font-bold capitalize"
              style={{ color: CATEGORY_COLORS[patternStats.mostActive] || '#94a3b8' }}
            >
              {patternStats.mostActive}
            </span>
          </div>

          {/* Signal Accuracy */}
          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
              Accuracy
            </div>
            <div className="flex items-center justify-center gap-1">
              <Target className="h-3 w-3 text-[#00ff41]" />
              <span className="font-mono text-xs font-bold text-[#00ff41]">
                {patternStats.signalAccuracy}
              </span>
            </div>
          </div>

          {/* Trending Pattern */}
          <div className="col-span-2 rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center sm:col-span-1">
            <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
              Trending
            </div>
            <div className="flex items-center justify-center gap-1">
              <Zap className="h-3 w-3 text-[#a855f7]" />
              <span className="truncate text-[9px] font-mono font-bold text-[#a855f7]">
                {patternStats.trendingPattern}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ─── Last scan time ─── */}
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-mono text-[#64748b]/60">
            Auto-refreshing every 30s · Last scan: {new Date(refreshKey).toLocaleTimeString('en-US', { hour12: false })}
          </span>
          <span className="text-[8px] font-mono text-[#64748b]/60">
            {clusters.length} clusters detected
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
