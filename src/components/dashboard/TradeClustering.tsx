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

  // No simulated clusters - empty state when no real data
  const clusters: TradeCluster[] = []

  // Compute timeline range
  const timelineRange = useMemo(() => {
    if (clusters.length === 0) return { min: Date.now() - 4 * 3600000, max: Date.now() }
    const times = clusters.flatMap((c) => [new Date(c.startTime).getTime(), new Date(c.endTime).getTime()])
    const min = Math.min(...times)
    const max = Math.max(...times)
    const padding = (max - min) * 0.05
    return { min: min - padding, max: max + padding }
  }, [clusters])

  // Top clusters by significance
  const topClusters = useMemo(() => {
    return clusters.slice(0, 5)
  }, [clusters])

  // Pattern stats
  const patternStats = useMemo(() => {
    return {
      totalClusters: clusters.length,
      avgClusterSize: clusters.length > 0 ? (clusters.reduce((s, c) => s + c.tradeCount, 0) / clusters.length).toFixed(1) : '0',
      mostActive: '-',
      signalAccuracy: '0%',
      trendingPattern: 'No real-time data available',
    }
  }, [clusters])

  // Group clusters by category
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
        {clusters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#64748b]">
            <Radar className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-xs">No trade clusters detected</p>
            <p className="text-[10px] text-[#334155] mt-1">Waiting for real trade data</p>
          </div>
        ) : (
          <>
            {/* Cluster Detection Timeline */}
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
              {/* ... cluster visualization would render here */}
            </motion.div>

            {/* Active Clusters List */}
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {topClusters.map((cluster) => {
                const color = CATEGORY_COLORS[cluster.category]
                const isExpanded = expandedCluster === cluster.id
                return (
                  <motion.div
                    key={cluster.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3 }}
                    className={`group cursor-pointer rounded-lg border bg-[#0a0e17]/50 p-2.5 transition-all duration-200 ${
                      isExpanded ? 'border-[#1e293b] bg-[#0f1724]/80 shadow-lg' : 'border-[#1e293b]/40 hover:border-[#1e293b]/80 hover:bg-[#0f1724]/60'
                    }`}
                    onClick={() => toggleExpand(cluster.id)}
                    onMouseEnter={() => setHighlightedCategory(cluster.category)}
                    onMouseLeave={() => setHighlightedCategory(null)}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        {CATEGORY_ICONS[cluster.category]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-[#94a3b8]">
                            {formatTimeUTC(cluster.startTime)} — {formatTimeUTC(cluster.endTime)} UTC
                          </span>
                          <Badge className={`h-4 px-1.5 text-[8px] font-mono font-bold ${SIGNAL_STRENGTH_STYLES[cluster.signalStrength]}`}>
                            {cluster.signalStrength.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[9px] text-[#64748b]">
                            <Users className="h-2.5 w-2.5" />
                            <span className="font-mono font-medium" style={{ color }}>{cluster.traderCount}</span>
                            {' edge traders'}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] text-[#64748b]">
                            <Activity className="h-2.5 w-2.5" />
                            <span className="font-mono font-medium" style={{ color }}>{cluster.tradeCount}</span>
                            {' coordinated trades'}
                          </span>
                        </div>
                      </div>
                      <Badge
                        className={`h-5 shrink-0 px-2 text-[9px] font-mono font-bold ${
                          cluster.direction === 'BULLISH'
                            ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/20'
                            : 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/20'
                        }`}
                      >
                        {cluster.direction === 'BULLISH' ? <TrendingUp className="mr-0.5 h-2.5 w-2.5" /> : <TrendingDown className="mr-0.5 h-2.5 w-2.5" />}
                        {cluster.direction}
                      </Badge>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </>
        )}

        {/* Summary Stats */}
        <div className="flex items-center justify-between rounded-lg border border-[#1e293b] bg-[#0a0e17]/80 px-3 py-2.5">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[9px] text-[#64748b]">Total Clusters</div>
              <div className="font-mono text-xs font-bold text-[#e2e8f0]">{patternStats.totalClusters}</div>
            </div>
            <div className="h-8 w-px bg-[#1e293b]" />
            <div>
              <div className="text-[9px] text-[#64748b]">Avg Size</div>
              <div className="font-mono text-xs font-bold text-[#f59e0b]">{patternStats.avgClusterSize}</div>
            </div>
            <div className="h-8 w-px bg-[#1e293b]" />
            <div>
              <div className="text-[9px] text-[#64748b]">Most Active</div>
              <div className="font-mono text-xs font-bold text-[#a855f7]">{patternStats.mostActive}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
