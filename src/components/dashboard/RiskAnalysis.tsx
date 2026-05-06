'use client'

import { useMemo, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Shield,
  TrendingDown,
  BarChart3,
  AlertTriangle,
  Activity,
  Zap,
  Target,
  ArrowDownRight,
  Play,
  RotateCcw,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { PerformancePoint, AgentState } from '@/lib/store'

interface RiskMetricProps {
  icon: React.ElementType
  label: string
  value: string
  color: string
  subLabel?: string
  title?: string
}

function RiskMetric({ icon: Icon, label, value, color, subLabel, title }: RiskMetricProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[#1e293b] bg-[#0a0e17]/60 px-3 py-2.5" title={title}>
      <Icon className="h-4 w-4 shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-wider text-[#64748b]">{label}</div>
        <div className="font-mono text-sm font-bold" style={{ color }}>
          {value}
        </div>
        {subLabel && <div className="text-[8px] text-[#64748b]">{subLabel}</div>}
      </div>
    </div>
  )
}

function computeRiskLevel(
  maxDrawdown: number,
  sharpe: number,
  var95: number
): { level: string; color: string; emoji: string; percent: number } {
  let score = 0
  // Drawdown scoring (lower is better)
  if (maxDrawdown < 0.1) score += 2
  else if (maxDrawdown < 0.25) score += 1
  else score += 0

  // Sharpe scoring (higher is better)
  if (sharpe > 2) score += 2
  else if (sharpe > 1) score += 1
  else score += 0

  // VaR scoring (lower is better)
  if (var95 < 0.05) score += 2
  else if (var95 < 0.15) score += 1
  else score += 0

  if (score >= 5) return { level: 'Low Risk', color: '#00ff41', emoji: '🟢', percent: 20 }
  if (score >= 3) return { level: 'Medium Risk', color: '#f59e0b', emoji: '🟡', percent: 55 }
  return { level: 'High Risk', color: '#ef4444', emoji: '🔴', percent: 85 }
}

function runMonteCarlo(
  winRate: number,
  avgWin: number,
  avgLoss: number,
  currentCapital: number,
  days: number,
  paths: number
) {
  const simulations: number[][] = Array.from({ length: paths }, () => [currentCapital])

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < paths; p++) {
      const lastVal = simulations[p][simulations[p].length - 1]
      const isWin = Math.random() < winRate
      const pnl = isWin ? avgWin * (0.5 + Math.random()) : -avgLoss * (0.5 + Math.random())
      simulations[p].push(Math.max(lastVal + pnl, 0))
    }
  }

  // Calculate percentiles per day
  const result = []
  for (let d = 0; d <= days; d++) {
    const values = simulations.map((s) => s[d]).sort((a, b) => a - b)
    const p25 = values[Math.floor(paths * 0.25)]
    const p50 = values[Math.floor(paths * 0.5)]
    const p75 = values[Math.floor(paths * 0.75)]
    result.push({
      day: d === 0 ? 'Now' : `D${d}`,
      p25: parseFloat(p25.toFixed(2)),
      p50: parseFloat(p50.toFixed(2)),
      p75: parseFloat(p75.toFixed(2)),
    })
  }
  return result
}

export function RiskAnalysis() {
  const { data: agentData, isLoading: agentLoading } = useQuery<{
    state: AgentState
    recentDecisions: unknown[]
  }>({
    queryKey: ['agent'],
    queryFn: () => fetch('/api/agent').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const { data: performance, isLoading: perfLoading } = useQuery<PerformancePoint[]>({
    queryKey: ['performance'],
    queryFn: () => fetch('/api/performance').then((r) => r.json()),
    refetchInterval: 60000,
  })

  const agent = agentData?.state

  const metrics = useMemo(() => {
    if (!agent || !performance) return null

    const maxDrawdown = agent.maxDrawdown ?? 0

    // Sharpe ratio from agent
    const sharpe = agent.sharpeRatio ?? 0

    // Compute Sortino ratio from performance data
    const returns: number[] = []
    for (let i = 1; i < performance.length; i++) {
      const ret = (performance[i].capital - performance[i - 1].capital) / performance[i - 1].capital
      returns.push(ret)
    }
    const avgReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0
    const downsideReturns = returns.filter((r) => r < 0)
    const downsideDeviation =
      downsideReturns.length > 0
        ? Math.sqrt(downsideReturns.reduce((s, r) => s + r * r, 0) / downsideReturns.length)
        : 0.01
    const sortinoRaw = downsideDeviation > 0 ? (avgReturn / downsideDeviation) * Math.sqrt(365) : 0
    const sortino = Math.min(sortinoRaw, 99.9)

    // VaR (95%) - use the 95th percentile of drawdowns
    const drawdowns = performance.map((p) => p.drawdown).sort((a, b) => b - a)
    const var95Index = Math.floor(drawdowns.length * 0.05)
    const var95 = drawdowns[var95Index] ?? 0

    // Win/Loss ratio from performance data simulation
    const positiveReturns = returns.filter((r) => r > 0)
    const negativeReturns = returns.filter((r) => r < 0)
    const avgWinReturn = positiveReturns.length > 0
      ? positiveReturns.reduce((s, r) => s + r, 0) / positiveReturns.length
      : 0
    const avgLossReturn = negativeReturns.length > 0
      ? Math.abs(negativeReturns.reduce((s, r) => s + r, 0) / negativeReturns.length)
      : 0.01
    const winLossRatioRaw = avgLossReturn > 0 ? avgWinReturn / avgLossReturn : 0
    const winLossRatio = Math.min(winLossRatioRaw, 99.9)

    // Profit Factor
    const grossProfit = positiveReturns.reduce((s, r) => s + r, 0)
    const grossLoss = Math.abs(negativeReturns.reduce((s, r) => s + r, 0))
    const profitFactorRaw = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0
    const profitFactor = Math.min(profitFactorRaw, 99.9)

    return {
      maxDrawdown,
      sharpe,
      sortino,
      var95,
      winLossRatio,
      profitFactor,
    }
  }, [agent, performance])

  const drawdownData = useMemo(() => {
    if (!performance) return []
    return performance.map((p) => ({
      time: new Date(p.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      drawdown: parseFloat((p.drawdown * 100).toFixed(2)),
    }))
  }, [performance])

  const maxDdPoint = useMemo(() => {
    if (drawdownData.length === 0) return null
    return drawdownData.reduce((max, d) => (d.drawdown > max.drawdown ? d : max), drawdownData[0])
  }, [drawdownData])

  // Monte Carlo: only run on demand (not on every render)
  const [mcData, setMcData] = useState<Array<{ day: string; p25: number; p50: number; p75: number }>>([])
  const [mcRunning, setMcRunning] = useState(false)

  const handleRunMonteCarlo = useCallback(() => {
    if (!agent) return
    setMcRunning(true)
    // Use requestAnimationFrame to avoid blocking the UI
    requestAnimationFrame(() => {
      const winRate = agent.winRate ?? 0.6
      const avgWin = (agent.currentCapital ?? 1000) * 0.05
      const avgLoss = (agent.currentCapital ?? 1000) * 0.03
      const currentCapital = agent.currentCapital ?? 1000
      const result = runMonteCarlo(winRate, avgWin, avgLoss, currentCapital, 30, 200)
      setMcData(result)
      setMcRunning(false)
    })
  }, [agent])

  const riskLevel = useMemo(() => {
    if (!metrics) return { level: 'Unknown', color: '#64748b', emoji: '⚪', percent: 50 }
    return computeRiskLevel(metrics.maxDrawdown, metrics.sharpe, metrics.var95)
  }, [metrics])

  if (agentLoading || perfLoading) {
    return (
      <Card className="card-accent-red border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Shield className="h-4 w-4 text-[#ef4444]" />
            RISK ANALYSIS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full bg-[#1e293b]/50" />
        </CardContent>
      </Card>
    )
  }

  if (!metrics) {
    return (
      <Card className="card-accent-red border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Shield className="h-4 w-4 text-[#ef4444]" />
            RISK ANALYSIS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-[#64748b]">Waiting for data...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-red border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Shield className="h-4 w-4 text-[#ef4444]" />
            RISK ANALYSIS
          </span>
          {/* Risk Level Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-base">{riskLevel.emoji}</span>
            <span
              className="font-mono text-xs font-bold"
              style={{ color: riskLevel.color }}
            >
              {riskLevel.level}
            </span>
            <div className="h-2 w-20 overflow-hidden rounded-full bg-[#1e293b]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${riskLevel.percent}%`,
                  backgroundColor: riskLevel.color,
                }}
              />
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk Metrics Grid (2x3) */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <RiskMetric
            icon={TrendingDown}
            label="Max Drawdown"
            value={`${(metrics.maxDrawdown * 100).toFixed(1)}%`}
            color="#ef4444"
            subLabel="Peak to trough decline"
          />
          <RiskMetric
            icon={BarChart3}
            label="Sharpe Ratio"
            value={metrics.sharpe.toFixed(2)}
            color={metrics.sharpe > 2 ? '#00ff41' : metrics.sharpe >= 1 ? '#f59e0b' : '#ef4444'}
            subLabel={metrics.sharpe > 2 ? 'Excellent' : metrics.sharpe >= 1 ? 'Acceptable' : 'Poor'}
            title="Risk-adjusted return metric (higher is better)"
          />
          <RiskMetric
            icon={Target}
            label="Sortino Ratio"
            value={metrics.sortino.toFixed(2)}
            color={metrics.sortino > 3 ? '#00ff41' : metrics.sortino >= 1.5 ? '#f59e0b' : '#ef4444'}
            subLabel="Downside risk adjusted"
          />
          <RiskMetric
            icon={AlertTriangle}
            label="VaR (95%)"
            value={`${(metrics.var95 * 100).toFixed(1)}%`}
            color={metrics.var95 < 0.05 ? '#00ff41' : metrics.var95 < 0.15 ? '#f59e0b' : '#ef4444'}
            subLabel="Value at Risk"
          />
          <RiskMetric
            icon={Activity}
            label="Win/Loss Ratio"
            value={metrics.winLossRatio.toFixed(2)}
            color={metrics.winLossRatio > 1.5 ? '#00ff41' : metrics.winLossRatio >= 1 ? '#f59e0b' : '#ef4444'}
            subLabel="Avg win / Avg loss"
          />
          <RiskMetric
            icon={Zap}
            label="Profit Factor"
            value={metrics.profitFactor.toFixed(2)}
            color={metrics.profitFactor > 2 ? '#00ff41' : metrics.profitFactor >= 1 ? '#f59e0b' : '#ef4444'}
            subLabel="Gross profit / Gross loss"
          />
        </div>

        {/* Drawdown Chart */}
        <div className="space-y-1.5">
          <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            <ArrowDownRight className="h-3 w-3 text-[#ef4444]" />
            Drawdown History
          </h3>
          <div className="h-[100px] w-full rounded-lg border border-[#1e293b] bg-[#0a0e17]/40 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={drawdownData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  stroke="#334155"
                  tick={{ fill: '#64748b', fontSize: 8 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(val) => `${val}%`}
                  stroke="#334155"
                  tick={{ fill: '#64748b', fontSize: 8 }}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f1724',
                    border: '1px solid #1e293b',
                    borderRadius: '6px',
                    fontSize: '10px',
                    color: '#e2e8f0',
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
                />
                {maxDdPoint && (
                  <ReferenceLine
                    y={maxDdPoint.drawdown}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    strokeOpacity={0.6}
                    label={{
                      value: `Max ${(maxDdPoint.drawdown).toFixed(1)}%`,
                      position: 'right',
                      fill: '#ef4444',
                      fontSize: 8,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  fill="url(#ddGradient)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monte Carlo Simulation */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
              <BarChart3 className="h-3 w-3 text-[#22d3ee]" />
              Monte Carlo Simulation (30-Day Projection)
            </h3>
            <button
              onClick={handleRunMonteCarlo}
              disabled={!agent || mcRunning}
              className="flex items-center gap-1 rounded-md border border-[#22d3ee]/30 bg-[#22d3ee]/10 px-2 py-0.5 text-[9px] font-bold text-[#22d3ee] transition-all hover:bg-[#22d3ee]/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mcRunning ? (
                <RotateCcw className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Play className="h-2.5 w-2.5" />
              )}
              {mcRunning ? 'Running...' : mcData.length > 0 ? 'Re-run' : 'Run Simulation'}
            </button>
          </div>
          {mcData.length === 0 ? (
            <div className="flex h-[120px] items-center justify-center rounded-lg border border-[#1e293b] bg-[#0a0e17]/40">
              <div className="text-center">
                <BarChart3 className="mx-auto mb-1.5 h-6 w-6 text-[#1e293b]" />
                <p className="text-[10px] text-[#64748b]">Click "Run Simulation" to project 30-day outcomes</p>
                <p className="text-[8px] text-[#334155]">200 paths · 30 days · Based on current win rate & P&L</p>
              </div>
            </div>
          ) : (
          <div className="h-[120px] w-full rounded-lg border border-[#1e293b] bg-[#0a0e17]/40 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mcData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="mc75" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  stroke="#334155"
                  tick={{ fill: '#64748b', fontSize: 8 }}
                  tickLine={false}
                  axisLine={false}
                  interval={5}
                />
                <YAxis
                  tickFormatter={(val) =>
                    val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val.toFixed(0)}`
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
                  formatter={(value: number, name: string) => {
                    const label = name === 'p50' ? 'Median' : name === 'p75' ? '75th pct' : '25th pct'
                    return [
                      `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                      label,
                    ]
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="p75"
                  stroke="#22d3ee"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  strokeOpacity={0.4}
                  dot={false}
                  activeDot={false}
                />
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="#22d3ee"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: '#22d3ee', stroke: '#0f1724', strokeWidth: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="p25"
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                  strokeOpacity={0.5}
                  dot={false}
                  activeDot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          )}
          {mcData.length > 0 && (
          <div className="flex items-center justify-center gap-4 text-[8px] text-[#64748b]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 rounded bg-[#ef4444]/50" />
              25th percentile
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 rounded bg-[#22d3ee]" />
              Median path
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 rounded bg-[#22d3ee]/40" />
              75th percentile
            </span>
          </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
