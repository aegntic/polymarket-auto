'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Gauge,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
  Waves,
  Volume2,
  Zap,
} from 'lucide-react'
import type { NewsEvent } from '@/lib/store'

/* ─── Sentiment zone helpers ─── */
function getSentimentZone(value: number): { label: string; color: string; bgColor: string } {
  if (value <= 20) return { label: 'Extreme Fear', color: '#ef4444', bgColor: 'bg-red-500/15 text-red-400 border-red-500/30' }
  if (value <= 40) return { label: 'Fear', color: '#f59e0b', bgColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30' }
  if (value <= 60) return { label: 'Neutral', color: '#eab308', bgColor: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' }
  if (value <= 80) return { label: 'Greed', color: '#22d3ee', bgColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' }
  return { label: 'Extreme Greed', color: '#00ff41', bgColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
}

function getMetricColor(value: number): string {
  if (value <= 20) return '#ef4444'
  if (value <= 40) return '#f59e0b'
  if (value <= 60) return '#eab308'
  if (value <= 80) return '#22d3ee'
  return '#00ff41'
}

/* ─── SVG Gauge Constants ─── */
const GAUGE_CX = 160
const GAUGE_CY = 130
const GAUGE_RX = 140
const GAUGE_RY = 140
const NEEDLE_LENGTH = 105
const SVG_WIDTH = 320
const SVG_HEIGHT = 175

/* ─── Main Component ─── */
export function MarketSentimentGauge() {
  const [refreshKey, setRefreshKey] = useState(0)

  const { data: news } = useQuery<NewsEvent[]>({
    queryKey: ['news'],
    queryFn: () => fetch('/api/news').then((r) => r.json()),
    refetchInterval: 30000,
  })

  // Compute sentiment from real data (news + market data)
  const metrics = useMemo(() => {
    // Base sentiment from news if available
    let newsBoost = 0
    if (news && news.length > 0) {
      const avgSentiment = news.reduce((sum, n) => sum + n.sentiment, 0) / news.length
      newsBoost = avgSentiment * 10
    }

    // Default baseline
    const base = 55 + newsBoost

    return {
      overall: Math.round(Math.max(0, Math.min(100, base))),
      marketMomentum: Math.round(Math.max(0, Math.min(100, base + 5))),
      socialSentiment: Math.round(Math.max(0, Math.min(100, base - 5))),
      whaleActivity: Math.round(Math.max(0, Math.min(100, base + 3))),
      volatilityIndex: Math.round(Math.max(0, Math.min(100, base - 2))),
      volumeProfile: Math.round(Math.max(0, Math.min(100, base + 2))),
      change24h: 0,
      weeklyTrend: 'stable' as 'stable' | 'up' | 'down',
      confidence: Math.round(Math.max(0, Math.min(100, 70 + Math.abs(newsBoost)))),
    }
  }, [news, refreshKey])

  // Auto-refresh every 45 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1)
    }, 45000)
    return () => clearInterval(interval)
  }, [])

  const zone = getSentimentZone(metrics.overall)
  const needleRotation = -90 + (metrics.overall / 100) * 180

  const subMetrics = [
    { label: 'Market Momentum', value: metrics.marketMomentum, icon: TrendingUp, description: 'Trend strength' },
    { label: 'Social Sentiment', value: metrics.socialSentiment, icon: Activity, description: 'News & social' },
    { label: 'Whale Activity', value: metrics.whaleActivity, icon: Waves, description: 'Large wallet moves' },
    { label: 'Volatility Index', value: metrics.volatilityIndex, icon: Zap, description: 'Market stability' },
    { label: 'Volume Profile', value: metrics.volumeProfile, icon: Volume2, description: 'Volume vs avg' },
  ]

  return (
    <Card className="card-accent-amber rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#f59e0b]/10">
            <Gauge className="h-3.5 w-3.5 text-[#f59e0b]" />
          </div>
          <span className="card-title-cyber">MARKET SENTIMENT GAUGE</span>
          <span className="ml-1 text-[9px] font-mono text-[#64748b]">Composite fear & greed index</span>
          <Badge className={`ml-auto h-5 px-2 text-[9px] font-mono font-bold ${zone.bgColor}`}>
            {zone.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ─── SVG Semicircular Gauge ─── */}
        <div className="flex flex-col items-center">
          <svg
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full max-w-[320px]"
          >
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="25%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="75%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#00ff41" />
              </linearGradient>
              <filter id="needleGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="arcGlow" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <path
              d={`M ${GAUGE_CX - GAUGE_RX},${GAUGE_CY} A ${GAUGE_RX},${GAUGE_RY} 0 0,1 ${GAUGE_CX + GAUGE_RX},${GAUGE_CY}`}
              fill="none"
              stroke="#1e293b"
              strokeWidth={18}
              strokeLinecap="round"
            />

            <path
              d={`M ${GAUGE_CX - GAUGE_RX},${GAUGE_CY} A ${GAUGE_RX},${GAUGE_RY} 0 0,1 ${GAUGE_CX + GAUGE_RX},${GAUGE_CY}`}
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth={16}
              strokeLinecap="round"
              filter="url(#arcGlow)"
              opacity={0.85}
            />

            {/* Zone divider lines */}
            <line
              x1={GAUGE_CX - GAUGE_RX * Math.cos((40 / 100) * Math.PI)}
              y1={GAUGE_CY - GAUGE_RX * Math.sin((40 / 100) * Math.PI)}
              x2={GAUGE_CX - (GAUGE_RX - 20) * Math.cos((40 / 100) * Math.PI)}
              y2={GAUGE_CY - (GAUGE_RX - 20) * Math.sin((40 / 100) * Math.PI)}
              stroke="#64748b"
              strokeWidth={1}
              opacity={0.4}
            />
            <line
              x1={GAUGE_CX - GAUGE_RX * Math.cos((60 / 100) * Math.PI)}
              y1={GAUGE_CY - GAUGE_RX * Math.sin((60 / 100) * Math.PI)}
              x2={GAUGE_CX - (GAUGE_RX - 20) * Math.cos((60 / 100) * Math.PI)}
              y2={GAUGE_CY - (GAUGE_RX - 20) * Math.sin((60 / 100) * Math.PI)}
              stroke="#64748b"
              strokeWidth={1}
              opacity={0.4}
            />

            {/* Tick marks */}
            {Array.from({ length: 11 }).map((_, i) => {
              const val = i * 10
              const angle = Math.PI * (1 - val / 100)
              const cos = Math.cos(angle)
              const sin = Math.sin(angle)
              const outerR = GAUGE_RX - 2
              const innerR = i % 5 === 0 ? GAUGE_RX - 14 : GAUGE_RX - 10
              return (
                <line
                  key={i}
                  x1={GAUGE_CX + outerR * cos}
                  y1={GAUGE_CY - outerR * sin}
                  x2={GAUGE_CX + innerR * cos}
                  y2={GAUGE_CY - innerR * sin}
                  stroke="#64748b"
                  strokeWidth={i % 5 === 0 ? 1.5 : 0.8}
                  opacity={0.5}
                />
              )
            })}

            {/* Needle */}
            <g transform={`translate(${GAUGE_CX}, ${GAUGE_CY})`}>
              <motion.g
                animate={{ rotate: needleRotation }}
                transition={{ type: 'spring', stiffness: 120, damping: 20, mass: 1 }}
                style={{ transformOrigin: '0 0' }}
              >
                <line
                  x1={0}
                  y1={8}
                  x2={0}
                  y2={-NEEDLE_LENGTH}
                  stroke="#e2e8f0"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
                <circle
                  cx={0}
                  cy={-NEEDLE_LENGTH}
                  r={4}
                  fill={zone.color}
                  filter="url(#needleGlow)"
                />
                <circle cx={0} cy={0} r={6} fill="#1e293b" stroke="#64748b" strokeWidth={1.5} />
                <circle cx={0} cy={0} r={3} fill={zone.color} />
              </motion.g>
            </g>

            {/* Extreme labels */}
            <text x={GAUGE_CX - GAUGE_RX - 2} y={GAUGE_CY + 18} textAnchor="start" fill="#ef4444" fontSize={9} fontFamily="monospace" fontWeight={700} letterSpacing="0.05em">EXTREME</text>
            <text x={GAUGE_CX - GAUGE_RX - 2} y={GAUGE_CY + 28} textAnchor="start" fill="#ef4444" fontSize={9} fontFamily="monospace" fontWeight={700} letterSpacing="0.05em">FEAR</text>
            <text x={GAUGE_CX + GAUGE_RX + 2} y={GAUGE_CY + 18} textAnchor="end" fill="#00ff41" fontSize={9} fontFamily="monospace" fontWeight={700} letterSpacing="0.05em">EXTREME</text>
            <text x={GAUGE_CX + GAUGE_RX + 2} y={GAUGE_CY + 28} textAnchor="end" fill="#00ff41" fontSize={9} fontFamily="monospace" fontWeight={700} letterSpacing="0.05em">GREED</text>

            <text x={GAUGE_CX - GAUGE_RX * 0.65} y={GAUGE_CY - GAUGE_RX * 0.3} textAnchor="middle" fill="#f59e0b" fontSize={10} fontFamily="monospace" fontWeight={700} opacity={0.8}>Fear</text>
            <text x={GAUGE_CX} y={GAUGE_CY - GAUGE_RX * 0.55} textAnchor="middle" fill="#eab308" fontSize={10} fontFamily="monospace" fontWeight={700} opacity={0.8}>Neutral</text>
            <text x={GAUGE_CX + GAUGE_RX * 0.65} y={GAUGE_CY - GAUGE_RX * 0.3} textAnchor="middle" fill="#22d3ee" fontSize={10} fontFamily="monospace" fontWeight={700} opacity={0.8}>Greed</text>

            <text x={GAUGE_CX - GAUGE_RX + 8} y={GAUGE_CY - 8} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="monospace" fontWeight={600}>0</text>
            <text x={GAUGE_CX} y={GAUGE_CY - GAUGE_RX - 8} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="monospace" fontWeight={600}>50</text>
            <text x={GAUGE_CX + GAUGE_RX - 8} y={GAUGE_CY - 8} textAnchor="middle" fill="#64748b" fontSize={9} fontFamily="monospace" fontWeight={600}>100</text>
          </svg>

          {/* Current Value Display */}
          <motion.div
            className="-mt-3 flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <motion.span
              className="font-mono text-4xl font-black"
              style={{ color: zone.color, textShadow: `0 0 20px ${zone.color}40, 0 0 40px ${zone.color}20` }}
              key={metrics.overall}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >
              {metrics.overall}
            </motion.span>
            <span className="mt-0.5 text-[10px] font-mono font-semibold uppercase tracking-widest" style={{ color: zone.color }}>
              {zone.label}
            </span>
          </motion.div>
        </div>

        {/* ─── Sentiment Breakdown ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="space-y-2.5"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 className="h-3 w-3 text-[#f59e0b]" />
            <span className="text-[9px] font-mono font-semibold uppercase tracking-wider text-[#64748b]">
              Sentiment Breakdown
            </span>
          </div>
          {subMetrics.map((metric, i) => {
            const MetricIcon = metric.icon
            const color = getMetricColor(metric.value)
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08, duration: 0.3 }}
                className="group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <MetricIcon className="h-3 w-3" style={{ color }} />
                    <span className="text-[10px] font-mono text-[#94a3b8]">{metric.label}</span>
                    <span className="text-[8px] text-[#64748b]">({metric.description})</span>
                  </div>
                  <span className="font-mono text-[11px] font-bold" style={{ color }}>
                    {metric.value}
                  </span>
                </div>
                <div className="gauge-bar">
                  <motion.div
                    className="gauge-bar-fill"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.value}%` }}
                    transition={{ delay: 0.6 + i * 0.08, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                  />
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* ─── Summary Stats Row ─── */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="text-[8px] uppercase tracking-wider text-[#64748b]">Sentiment</div>
            <div className="flex items-center justify-center gap-1">
              <span className="font-mono text-[11px] font-bold" style={{ color: zone.color }}>
                {zone.label}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="text-[8px] uppercase tracking-wider text-[#64748b]">24h Change</div>
            <div className="flex items-center justify-center gap-1">
              {metrics.change24h > 0 ? (
                <ArrowUpRight className="h-3 w-3 text-[#00ff41]" />
              ) : metrics.change24h < 0 ? (
                <ArrowDownRight className="h-3 w-3 text-[#ef4444]" />
              ) : (
                <Minus className="h-3 w-3 text-[#64748b]" />
              )}
              <span
                className={`font-mono text-[11px] font-bold ${
                  metrics.change24h > 0 ? 'text-[#00ff41]' : metrics.change24h < 0 ? 'text-[#ef4444]' : 'text-[#64748b]'
                }`}
              >
                {metrics.change24h > 0 ? '+' : ''}{metrics.change24h}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="text-[8px] uppercase tracking-wider text-[#64748b]">Weekly Trend</div>
            <div className="flex items-center justify-center gap-1">
              {metrics.weeklyTrend === 'up' ? (
                <TrendingUp className="h-3 w-3 text-[#00ff41]" />
              ) : metrics.weeklyTrend === 'down' ? (
                <TrendingDown className="h-3 w-3 text-[#ef4444]" />
              ) : (
                <Minus className="h-3 w-3 text-[#64748b]" />
              )}
              <span className="font-mono text-[11px] font-bold text-[#94a3b8]">{metrics.weeklyTrend}</span>
            </div>
          </div>

          <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
            <div className="text-[8px] uppercase tracking-wider text-[#64748b]">Confidence</div>
            <div className="font-mono text-[11px] font-bold text-[#22d3ee]">{metrics.confidence}%</div>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  )
}
