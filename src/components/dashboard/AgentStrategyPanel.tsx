'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Settings,
  Shield,
  Zap,
  Target,
  Gauge,
  Sliders,
  Brain,
  Cpu,
  Clock,
  TrendingUp,
  AlertTriangle,
  Filter,
  DollarSign,
  BarChart3,
  Activity,
} from 'lucide-react'
import type { AgentState } from '@/lib/store'

/* ─── Framer Motion Variants ─── */
const sectionVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' as const },
  },
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
}

const staggerItem = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' as const },
  },
}

/* ─── Animated Brain SVG ─── */
function AnimatedBrain({ running }: { running: boolean }) {
  return (
    <motion.div
      className="relative flex h-9 w-9 items-center justify-center"
      animate={
        running
          ? { scale: [1, 1.08, 1] }
          : {}
      }
      transition={
        running
          ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
          : {}
      }
    >
      <svg
        viewBox="0 0 32 32"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="16"
          cy="16"
          r="14"
          stroke={running ? '#22d3ee' : '#334155'}
          strokeWidth="1.5"
          strokeOpacity={running ? 0.4 : 0.3}
          fill={running ? '#22d3ee' : '#334155'}
          fillOpacity={running ? 0.06 : 0.03}
        />
        <motion.circle
          cx="16"
          cy="16"
          r="14"
          stroke="#22d3ee"
          strokeWidth="1"
          fill="none"
          strokeOpacity={running ? 0.6 : 0}
          animate={
            running
              ? {
                  r: [14, 17, 14],
                  strokeOpacity: [0.6, 0, 0.6],
                }
              : {}
          }
          transition={
            running
              ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
              : {}
          }
        />
        <path
          d="M16 8c-2 0-4 1.5-4 4 0 1.5.8 2.5 2 3.2V18c0 1.5 1 2.5 2 2.5s2-1 2-2.5v-2.8c1.2-.7 2-1.7 2-3.2 0-2.5-2-4-4-4z"
          fill={running ? '#22d3ee' : '#64748b'}
          fillOpacity={running ? 0.8 : 0.4}
        />
        <path
          d="M10 14c-1.5 0-2.5 1-2.5 2s1 2 2.5 2c.5 0 1-.2 1.3-.5"
          stroke={running ? '#22d3ee' : '#64748b'}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity={running ? 0.7 : 0.3}
        />
        <path
          d="M22 14c1.5 0 2.5 1 2.5 2s-1 2-2.5 2c-.5 0-1-.2-1.3-.5"
          stroke={running ? '#22d3ee' : '#64748b'}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity={running ? 0.7 : 0.3}
        />
        <path
          d="M12 18.5c-.8.5-1.5 1.5-1.5 2.5 0 1.5 1 3 2.5 3"
          stroke={running ? '#22d3ee' : '#64748b'}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity={running ? 0.7 : 0.3}
        />
        <path
          d="M20 18.5c.8.5 1.5 1.5 1.5 2.5 0 1.5-1 3-2.5 3"
          stroke={running ? '#22d3ee' : '#64748b'}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeOpacity={running ? 0.7 : 0.3}
        />
      </svg>
    </motion.div>
  )
}

/* ─── Elapsed Time Counter ─── */
function formatElapsed(ms: number): string {
  const hrs = Math.floor(ms / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function ElapsedTimeCounter({ startTime }: { startTime: string | null }) {
  const [elapsed, setElapsed] = useState(() =>
    startTime ? formatElapsed(Date.now() - new Date(startTime).getTime()) : '00:00:00'
  )

  useEffect(() => {
    if (!startTime) return
    const start = new Date(startTime).getTime()
    const interval = setInterval(() => {
      setElapsed(formatElapsed(Date.now() - start))
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  return (
    <span className="font-mono text-xs text-[#22d3ee]">{elapsed}</span>
  )
}

/* ─── Visual Gauge Bar ─── */
function GaugeBar({
  label,
  value,
  max,
  unit,
  color,
  icon: Icon,
}: {
  label: string
  value: number
  max: number
  unit: string
  color: string
  icon: React.ElementType
}) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <motion.div variants={staggerItem} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3" style={{ color }} />
          <span className="text-[10px] text-[#94a3b8]">{label}</span>
        </div>
        <span className="font-mono text-xs font-bold" style={{ color }}>
          {value}
          {unit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1e293b]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

/* ─── Confidence Bar Indicator ─── */
function ConfidenceIndicator({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string
  value: number
  color: string
  icon: React.ElementType
}) {
  return (
    <motion.div variants={staggerItem} className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3" style={{ color }} />
          <span className="text-[10px] text-[#94a3b8]">{label}</span>
        </div>
        <span className="font-mono text-xs font-bold" style={{ color }}>
          {value}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1e293b]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

/* ─── Performance Target Row ─── */
function PerformanceTarget({
  label,
  current,
  target,
  unit,
  color,
  icon: Icon,
}: {
  label: string
  current: number
  target: number
  unit: string
  color: string
  icon: React.ElementType
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const isOnTrack = current >= target
  const trackColor = isOnTrack ? '#00ff41' : color

  return (
    <motion.div variants={staggerItem} className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3" style={{ color }} />
          <span className="text-[10px] text-[#94a3b8]">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[#64748b]">
            target: {target}
            {unit}
          </span>
          <span className="font-mono text-xs font-bold" style={{ color: trackColor }}>
            {current}
            {unit}
          </span>
        </div>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#1e293b]">
        {/* Target marker */}
        <div
          className="absolute top-0 h-full w-px"
          style={{
            left: '100%',
            backgroundColor: '#64748b',
          }}
        />
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: trackColor }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

/* ─── Strategy Status Badge ─── */
function StrategyStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; border: string; label: string }> = {
    running: {
      color: 'text-[#00ff41]',
      bg: 'bg-[#00ff41]/10',
      border: 'border-[#00ff41]/30',
      label: 'RUNNING',
    },
    paused: {
      color: 'text-[#f59e0b]',
      bg: 'bg-[#f59e0b]/10',
      border: 'border-[#f59e0b]/30',
      label: 'PAUSED',
    },
    idle: {
      color: 'text-[#94a3b8]',
      bg: 'bg-[#64748b]/10',
      border: 'border-[#64748b]/30',
      label: 'IDLE',
    },
  }
  const c = config[status] || config.idle
  return (
    <Badge
      className={`flex items-center gap-1 border px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.border} ${c.color}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          status === 'running' ? 'animate-pulse bg-[#00ff41]' : status === 'paused' ? 'bg-[#f59e0b]' : 'bg-[#64748b]'
        }`}
      />
      {c.label}
    </Badge>
  )
}

/* ─── Main Component ─── */
export function AgentStrategyPanel() {
  const { data: agentData, isLoading, error } = useQuery<{
    state: AgentState
    recentDecisions: unknown[]
  }>({
    queryKey: ['agent'],
    queryFn: () => fetch('/api/agent').then((r) => r.json()),
    refetchInterval: 15000,
  })

  const agent = agentData?.state

  // Derive strategy parameters from agent state, with deterministic defaults
  const strategyParams = useMemo(() => {
    const winRate = agent?.winRate ?? 0.65
    const sharpe = agent?.sharpeRatio ?? 1.8
    const maxDrawdown = agent?.maxDrawdown ?? 0.12
    const capital = agent?.currentCapital ?? 4237.5
    const capitalBase = agent?.capitalBase ?? 2500

    // Deterministic derivations based on agent state
    const capitalRatio = capitalBase > 0 ? capital / capitalBase : 1

    return {
      // Strategy overview
      strategyName: agent?.currentStrategy || 'Adaptive Kelly Momentum',
      status: agent?.status || 'running',
      startedAt: agent?.startedAt || null,

      // Risk parameters (derived from agent metrics)
      kellyFraction: 0.25,
      maxPositionSize: Math.round(capital * 0.18 * 10) / 10,
      capital,
      stopLoss: -8,
      takeProfit: 50,
      maxDrawdownLimit: Math.round(maxDrawdown * 100),

      // Confidence thresholds
      minConfidenceToTrade: 75,
      minConfidenceToScan: 50,
      alertThreshold: 90,

      // Market filters
      activeCategories: ['crypto', 'economics', 'politics', 'science'],
      minVolume: '$1M',
      minLiquidity: '$500K',
      mispricingThreshold: '>0.5',

      // Performance targets
      targetWinRate: Math.round(winRate * 100),
      currentWinRate: Math.round(winRate * 100),
      targetSharpe: 2.0,
      currentSharpe: Math.round(sharpe * 10) / 10,
      dailyPnlTarget: 100,
    }
  }, [agent])

  if (error) {
    return (
      <Card className="card-accent-cyan border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Sliders className="h-4 w-4 text-[#22d3ee]" />
            AGENT STRATEGY
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load agent strategy data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-cyan border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <Sliders className="h-4 w-4 text-[#22d3ee]" />
          AGENT STRATEGY
          <span className="ml-auto text-[10px] font-mono text-[#64748b]">config</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full bg-[#1e293b]/50" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-36 bg-[#1e293b]/50" />
                <Skeleton className="h-3 w-20 bg-[#1e293b]/50" />
              </div>
            </div>
            <Skeleton className="h-3 w-full bg-[#1e293b]/50" />
            <Skeleton className="h-3 w-full bg-[#1e293b]/50" />
            <Skeleton className="h-3 w-3/4 bg-[#1e293b]/50" />
          </div>
        ) : (
          <>
            {/* ─── Strategy Overview ─── */}
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-3 rounded-lg border border-[#1e293b] bg-[#0a0e17]/60 p-3"
            >
              <AnimatedBrain running={strategyParams.status === 'running'} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-sm font-bold text-[#e2e8f0]">
                    {strategyParams.strategyName}
                  </span>
                  <StrategyStatusBadge status={strategyParams.status} />
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px]">
                  <div className="flex items-center gap-1 text-[#64748b]">
                    <Clock className="h-3 w-3 text-[#22d3ee]" />
                    <span>Uptime:</span>
                    <ElapsedTimeCounter startTime={strategyParams.startedAt} />
                  </div>
                  <div className="h-3 w-px bg-[#1e293b]" />
                  <div className="flex items-center gap-1 text-[#64748b]">
                    <Cpu className="h-3 w-3 text-[#a855f7]" />
                    <span>Agent v3.0</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ─── Risk Parameters ─── */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                <Shield className="h-3 w-3 text-[#ef4444]" />
                Risk Parameters
              </h3>
              <div className="space-y-2.5">
                <GaugeBar
                  label="Kelly Fraction"
                  value={strategyParams.kellyFraction}
                  max={1}
                  unit=" Kelly"
                  color="#00ff41"
                  icon={Target}
                />
                <GaugeBar
                  label="Max Position Size"
                  value={strategyParams.maxPositionSize}
                  max={strategyParams.capital}
                  unit=""
                  color="#22d3ee"
                  icon={Gauge}
                />
                <GaugeBar
                  label="Stop Loss"
                  value={Math.abs(strategyParams.stopLoss)}
                  max={50}
                  unit="%"
                  color="#ef4444"
                  icon={AlertTriangle}
                />
                <GaugeBar
                  label="Take Profit"
                  value={strategyParams.takeProfit}
                  max={100}
                  unit="%"
                  color="#00ff41"
                  icon={TrendingUp}
                />
                <GaugeBar
                  label="Max Drawdown Limit"
                  value={strategyParams.maxDrawdownLimit}
                  max={50}
                  unit="%"
                  color="#f59e0b"
                  icon={Shield}
                />
              </div>
            </motion.div>

            {/* ─── Confidence Thresholds ─── */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                <Brain className="h-3 w-3 text-[#a855f7]" />
                Confidence Thresholds
              </h3>
              <div className="space-y-2.5">
                <ConfidenceIndicator
                  label="Min Confidence to Trade"
                  value={strategyParams.minConfidenceToTrade}
                  color="#00ff41"
                  icon={Zap}
                />
                <ConfidenceIndicator
                  label="Min Confidence to Scan"
                  value={strategyParams.minConfidenceToScan}
                  color="#22d3ee"
                  icon={Settings}
                />
                <ConfidenceIndicator
                  label="Alert Threshold"
                  value={strategyParams.alertThreshold}
                  color="#f59e0b"
                  icon={AlertTriangle}
                />
              </div>
            </motion.div>

            {/* ─── Market Filters ─── */}
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                <Filter className="h-3 w-3 text-[#22d3ee]" />
                Market Filters
              </h3>

              {/* Active Categories */}
              <div className="flex flex-wrap items-center gap-1.5">
                {strategyParams.activeCategories.map((cat) => {
                  const catColors: Record<string, string> = {
                    crypto: '#00ff41',
                    economics: '#22d3ee',
                    politics: '#a855f7',
                    science: '#f59e0b',
                  }
                  const c = catColors[cat] || '#64748b'
                  return (
                    <Badge
                      key={cat}
                      className="border px-2 py-0.5 text-[10px] font-bold capitalize"
                      style={{
                        color: c,
                        backgroundColor: `${c}10`,
                        borderColor: `${c}30`,
                      }}
                    >
                      {cat}
                    </Badge>
                  )
                })}
              </div>

              {/* Filter Rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md border border-[#1e293b] bg-[#0a0e17]/50 px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="h-3 w-3 text-[#64748b]" />
                    <span className="text-[10px] text-[#94a3b8]">Min Volume</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#22d3ee]">
                    {strategyParams.minVolume}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-[#1e293b] bg-[#0a0e17]/50 px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3 w-3 text-[#64748b]" />
                    <span className="text-[10px] text-[#94a3b8]">Min Liquidity</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#22d3ee]">
                    {strategyParams.minLiquidity}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-[#1e293b] bg-[#0a0e17]/50 px-3 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-[#64748b]" />
                    <span className="text-[10px] text-[#94a3b8]">Mispricing Threshold</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#f59e0b]">
                    {strategyParams.mispricingThreshold}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* ─── Performance Targets ─── */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                <Target className="h-3 w-3 text-[#00ff41]" />
                Performance Targets
              </h3>
              <div className="space-y-2.5">
                <PerformanceTarget
                  label="Win Rate"
                  current={strategyParams.currentWinRate}
                  target={strategyParams.targetWinRate}
                  unit="%"
                  color="#f59e0b"
                  icon={TrendingUp}
                />
                <PerformanceTarget
                  label="Sharpe Ratio"
                  current={strategyParams.currentSharpe}
                  target={strategyParams.targetSharpe}
                  unit=""
                  color="#22d3ee"
                  icon={BarChart3}
                />
                <div className="flex items-center justify-between rounded-md border border-[#1e293b] bg-[#0a0e17]/50 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3 w-3 text-[#00ff41]" />
                    <span className="text-[10px] text-[#94a3b8]">Daily P&L Target</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-[#00ff41]">
                    ${strategyParams.dailyPnlTarget}
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
