'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis as ScatterX,
  YAxis as ScatterY,
  ZAxis,
  Tooltip as ScatterTooltip,
} from 'recharts'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Target, Eye, EyeOff } from 'lucide-react'

/* ─── Types ─── */
interface StrategyMetrics {
  totalReturn: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  avgTradeSize: number
  totalTrades: number
  profitFactor: number
  calmarRatio: number
}

interface StrategyConfig {
  name: string
  color: string
  description: string
}

interface StrategyData {
  name: string
  color: string
  description: string
  dailyReturns: number[]
  metrics: StrategyMetrics
}

/* ─── Strategy Definitions ─── */
const STRATEGY_OPTIONS: StrategyConfig[] = [
  { name: 'Kelly Optimal', color: '#00ff41', description: 'Aggressive Kelly criterion sizing' },
  { name: 'Half Kelly', color: '#22d3ee', description: 'Conservative half-Kelly sizing' },
  { name: 'Fixed 5%', color: '#f59e0b', description: 'Fixed 5% position sizing' },
  { name: 'Momentum', color: '#a855f7', description: 'Trend-following strategy' },
  { name: 'Mean Revert', color: '#ef4444', description: 'Contrarian strategy' },
  { name: 'Random', color: '#64748b', description: 'Random entry baseline' },
]

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

/* ─── Strategy Data Generator ─── */
function generateStrategyData(strategyName: string, seed: number): StrategyData {
  const config = STRATEGY_OPTIONS.find((s) => s.name === strategyName)!
  const rng = mulberry32(seed)
  const rand = () => rng() * 2 - 1 // -1 to 1

  const startingCapital = 2500
  const capital: number[] = [startingCapital]
  let current = startingCapital
  let peak = startingCapital
  let maxDD = 0
  let wins = 0
  let totalTrades = 0
  let grossProfit = 0
  let grossLoss = 0

  // Strategy-specific parameters
  let dailyMean: number
  let dailyVol: number
  let trendBias = 0
  let meanRevertStrength = 0

  switch (strategyName) {
    case 'Kelly Optimal':
      dailyMean = 0.025
      dailyVol = 0.065
      break
    case 'Half Kelly':
      dailyMean = 0.015
      dailyVol = 0.04
      break
    case 'Fixed 5%':
      dailyMean = 0.008
      dailyVol = 0.02
      break
    case 'Momentum':
      dailyMean = 0.012
      dailyVol = 0.045
      trendBias = 0.3
      break
    case 'Mean Revert':
      dailyMean = 0.01
      dailyVol = 0.035
      meanRevertStrength = 0.4
      break
    case 'Random':
      dailyMean = 0.001
      dailyVol = 0.03
      break
    default:
      dailyMean = 0.01
      dailyVol = 0.03
  }

  for (let day = 1; day <= 30; day++) {
    const prevReturn = day > 1 ? (capital[day - 1] - capital[day - 2]) / capital[day - 2] : 0

    // Momentum: if recent trend is positive, bias continuation
    let momentumComponent = 0
    if (trendBias > 0) {
      momentumComponent = prevReturn * trendBias * 3
    }

    // Mean revert: if recent move is large, expect pullback
    let meanRevertComponent = 0
    if (meanRevertStrength > 0) {
      meanRevertComponent = -prevReturn * meanRevertStrength * 2
    }

    // Random shock
    const shock = rand() * dailyVol

    // Daily return calculation
    const dailyReturn = dailyMean + momentumComponent + meanRevertComponent + shock

    // Kelly strategies have occasional large drawdowns (fat tail events)
    let kellyShock = 0
    if (strategyName === 'Kelly Optimal' && rng() < 0.08) {
      kellyShock = -(rng() * 0.12 + 0.05) // -5% to -17% shock
    } else if (strategyName === 'Half Kelly' && rng() < 0.05) {
      kellyShock = -(rng() * 0.06 + 0.02) // -2% to -8% shock
    }

    const adjustedReturn = dailyReturn + kellyShock
    current = current * (1 + adjustedReturn)
    capital.push(Math.max(current, startingCapital * 0.3)) // floor at 30% of starting

    // Track drawdown
    if (current > peak) peak = current
    const dd = (peak - current) / peak
    if (dd > maxDD) maxDD = dd

    // Track trades (approximate: 1-3 trades per day)
    const tradesToday = Math.floor(rng() * 3) + 1
    for (let t = 0; t < tradesToday; t++) {
      totalTrades++
      const tradeReturn = adjustedReturn / tradesToday + (rand() * dailyVol * 0.3)
      if (tradeReturn > 0) {
        wins++
        grossProfit += Math.abs(tradeReturn) * current * 0.1
      } else {
        grossLoss += Math.abs(tradeReturn) * current * 0.1
      }
    }
  }

  const finalCapital = capital[30]
  const totalReturn = (finalCapital - startingCapital) / startingCapital
  const winRate = totalTrades > 0 ? wins / totalTrades : 0
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0

  // Calculate daily returns array for Sharpe
  const dailyReturns: number[] = []
  for (let i = 1; i < capital.length; i++) {
    dailyReturns.push((capital[i] - capital[i - 1]) / capital[i - 1])
  }

  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
  const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / dailyReturns.length
  const stdDev = Math.sqrt(variance)
  const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(365) : 0 // annualized

  const calmarRatio = maxDD > 0 ? totalReturn / maxDD : 0

  return {
    name: config.name,
    color: config.color,
    description: config.description,
    dailyReturns: capital,
    metrics: {
      totalReturn: Math.round(totalReturn * 10000) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      maxDrawdown: Math.round(maxDD * 10000) / 100,
      winRate: Math.round(winRate * 10000) / 100,
      avgTradeSize: Math.round((finalCapital * 0.05) * 100) / 100,
      totalTrades,
      profitFactor: Math.round(profitFactor * 100) / 100,
      calmarRatio: Math.round(calmarRatio * 100) / 100,
    },
  }
}

/* ─── Custom Tooltip for Line Chart ─── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="mb-1 font-mono text-[9px] font-bold text-[#94a3b8]">Day {label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="font-mono text-[10px] text-[#94a3b8]">{entry.dataKey}:</span>
          <span className="font-mono text-[10px] font-bold text-[#e2e8f0]">
            ${entry.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─── Custom Tooltip for Scatter Chart ─── */
function ScatterChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; risk: number; return: number; color: string } }> }) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0].payload
  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="mb-1 font-mono text-[10px] font-bold" style={{ color: data.color }}>
        {data.name}
      </p>
      <p className="font-mono text-[9px] text-[#94a3b8]">
        Return: <span className="text-[#00ff41]">{data.return.toFixed(1)}%</span>
      </p>
      <p className="font-mono text-[9px] text-[#94a3b8]">
        Max DD: <span className="text-[#ef4444]">{data.risk.toFixed(1)}%</span>
      </p>
    </div>
  )
}

/* ─── Main Component ─── */
export function StrategyComparison() {
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([
    'Kelly Optimal',
    'Half Kelly',
    'Fixed 5%',
  ])
  const [visibleStrategies, setVisibleStrategies] = useState<Set<string>>(
    new Set(['Kelly Optimal', 'Half Kelly', 'Fixed 5%'])
  )

  // Generate all strategy data with consistent seeds
  const allStrategyData = useMemo(() => {
    const seeds: Record<string, number> = {
      'Kelly Optimal': 42,
      'Half Kelly': 137,
      'Fixed 5%': 256,
      'Momentum': 512,
      'Mean Revert': 777,
      'Random': 999,
    }
    return STRATEGY_OPTIONS.map((s) => generateStrategyData(s.name, seeds[s.name] || 100))
  }, [])

  // Get data for selected strategies
  const activeStrategyData = useMemo(() => {
    return selectedStrategies
      .map((name) => allStrategyData.find((s) => s.name === name))
      .filter((s): s is StrategyData => s !== undefined)
  }, [selectedStrategies, allStrategyData])

  // Build chart data (30 days, one entry per day with all strategy values)
  const chartData = useMemo(() => {
    return Array.from({ length: 31 }, (_, day) => {
      const entry: Record<string, number> = { day: day + 1 }
      for (const strategy of activeStrategyData) {
        if (visibleStrategies.has(strategy.name)) {
          entry[strategy.name] = Math.round(strategy.dailyReturns[day])
        }
      }
      return entry
    })
  }, [activeStrategyData, visibleStrategies])

  // Build scatter data for risk-return plot
  const scatterData = useMemo(() => {
    return activeStrategyData
      .filter((s) => visibleStrategies.has(s.name))
      .map((s) => ({
        name: s.name,
        risk: s.metrics.maxDrawdown,
        return: s.metrics.totalReturn,
        color: s.color,
        z: 120,
      }))
  }, [activeStrategyData, visibleStrategies])

  // Metrics to display in comparison table
  const comparisonMetrics = useMemo(() => {
    const metricKeys: { key: keyof StrategyMetrics; label: string; format: (v: number) => string; higherIsBetter: boolean }[] = [
      { key: 'totalReturn', label: 'Total Return', format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`, higherIsBetter: true },
      { key: 'sharpeRatio', label: 'Sharpe Ratio', format: (v) => v.toFixed(2), higherIsBetter: true },
      { key: 'maxDrawdown', label: 'Max Drawdown', format: (v) => `-${v.toFixed(1)}%`, higherIsBetter: false },
      { key: 'winRate', label: 'Win Rate', format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
      { key: 'profitFactor', label: 'Profit Factor', format: (v) => v.toFixed(2), higherIsBetter: true },
      { key: 'calmarRatio', label: 'Calmar Ratio', format: (v) => v.toFixed(2), higherIsBetter: true },
    ]

    return metricKeys.map((m) => {
      const values = activeStrategyData.map((s) => ({
        name: s.name,
        color: s.color,
        value: s.metrics[m.key],
      }))
      const bestValue = m.higherIsBetter
        ? Math.max(...values.map((v) => v.value))
        : Math.min(...values.map((v) => v.value))
      return { ...m, values, bestValue }
    })
  }, [activeStrategyData])

  const toggleStrategyVisibility = useCallback((name: string) => {
    setVisibleStrategies((prev) => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }, [])

  const handleStrategyChange = useCallback((slotIndex: number, newName: string) => {
    setSelectedStrategies((prev) => {
      const next = [...prev]
      // Remove old strategy from visible set if it's no longer selected
      const oldName = next[slotIndex]
      next[slotIndex] = newName
      // Add new strategy to visible set
      setVisibleStrategies((vis) => {
        const nextVis = new Set(vis)
        if (oldName && nextVis.has(oldName) && !next.includes(oldName)) {
          nextVis.delete(oldName)
        }
        nextVis.add(newName)
        return nextVis
      })
      return next
    })
  }, [])

  return (
    <Card className="card-accent-red card-shadow-deep chart-gradient-bg rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#ef4444]" />
            <span className="card-title-cyber">STRATEGY COMPARISON</span>
          </div>
          <span className="text-[10px] text-[#64748b]">Side-by-side strategy analysis</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ─── Strategy Selector ─── */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedStrategies.map((selectedName, slotIndex) => {
            const config = STRATEGY_OPTIONS.find((s) => s.name === selectedName)!
            const isVisible = visibleStrategies.has(selectedName)
            return (
              <div key={slotIndex} className="flex items-center gap-1.5">
                <div
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all duration-200"
                  style={{
                    backgroundColor: isVisible ? `${config.color}10` : 'transparent',
                    borderColor: isVisible ? `${config.color}40` : '#1e293b',
                    opacity: isVisible ? 1 : 0.5,
                  }}
                >
                  <button
                    onClick={() => toggleStrategyVisibility(selectedName)}
                    className="flex items-center gap-1.5"
                    title={isVisible ? 'Hide strategy' : 'Show strategy'}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full transition-all"
                      style={{
                        backgroundColor: config.color,
                        boxShadow: isVisible ? `0 0 6px ${config.color}60` : 'none',
                      }}
                    />
                    {isVisible ? (
                      <Eye className="h-3 w-3" style={{ color: config.color }} />
                    ) : (
                      <EyeOff className="h-3 w-3 text-[#64748b]" />
                    )}
                  </button>
                  <select
                    value={selectedName}
                    onChange={(e) => handleStrategyChange(slotIndex, e.target.value)}
                    className="h-5 border-0 bg-transparent font-mono text-[10px] font-bold outline-none"
                    style={{ color: config.color }}
                  >
                    {STRATEGY_OPTIONS.map((opt) => (
                      <option key={opt.name} value={opt.name} className="bg-[#0a0e17] text-[#e2e8f0]">
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>

        {/* ─── Overlaid Performance Chart ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" strokeOpacity={0.5} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={{ stroke: '#1e293b' }}
                  label={{ value: 'Day', position: 'insideBottom', offset: -2, style: { fill: '#64748b', fontSize: 9, fontFamily: 'monospace' } }}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 9, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={{ stroke: '#1e293b' }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                  label={{ value: 'Capital', angle: -90, position: 'insideLeft', offset: 15, style: { fill: '#64748b', fontSize: 9, fontFamily: 'monospace' } }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace', paddingTop: '4px' }}
                  formatter={(value: string) => (
                    <span style={{ color: STRATEGY_OPTIONS.find((s) => s.name === value)?.color || '#94a3b8' }}>
                      {value}
                    </span>
                  )}
                />
                {activeStrategyData
                  .filter((s) => visibleStrategies.has(s.name))
                  .map((strategy) => (
                    <Line
                      key={strategy.name}
                      type="monotone"
                      dataKey={strategy.name}
                      stroke={strategy.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0, fill: strategy.color }}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ─── Metrics Comparison Table ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e293b]/50">
                  <th className="pb-1.5 pr-3 text-left font-mono text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
                    Metric
                  </th>
                  {activeStrategyData.map((s) => (
                    <th
                      key={s.name}
                      className="pb-1.5 px-2 text-right font-mono text-[9px] font-semibold uppercase tracking-wider"
                      style={{ color: s.color }}
                    >
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonMetrics.map((metric) => (
                  <tr key={metric.key} className="border-b border-[#1e293b]/20 transition-colors hover:bg-[#1e293b]/10">
                    <td className="py-1.5 pr-3 font-mono text-[10px] text-[#94a3b8]">
                      {metric.label}
                    </td>
                    {metric.values.map((v) => {
                      const isBest = v.value === metric.bestValue
                      return (
                        <td
                          key={v.name}
                          className={`py-1.5 px-2 text-right font-mono text-[10px] font-bold ${
                            isBest ? 'text-[#00ff41]' : 'text-[#e2e8f0]'
                          }`}
                        >
                          {metric.format(v.value)}
                          {isBest && (
                            <span className="ml-1 inline-block text-[8px] text-[#00ff41]">&#9650;</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ─── Risk-Return Scatter Plot ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
              Risk-Return Profile
            </span>
          </div>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" strokeOpacity={0.4} />
                <ScatterX
                  type="number"
                  dataKey="risk"
                  name="Max Drawdown"
                  tick={{ fill: '#64748b', fontSize: 8, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={{ stroke: '#1e293b' }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  label={{ value: 'Risk (Max DD)', position: 'insideBottom', offset: -2, style: { fill: '#64748b', fontSize: 8, fontFamily: 'monospace' } }}
                />
                <ScatterY
                  type="number"
                  dataKey="return"
                  name="Total Return"
                  tick={{ fill: '#64748b', fontSize: 8, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#1e293b' }}
                  tickLine={{ stroke: '#1e293b' }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  label={{ value: 'Return', angle: -90, position: 'insideLeft', offset: 15, style: { fill: '#64748b', fontSize: 8, fontFamily: 'monospace' } }}
                />
                <ZAxis type="number" dataKey="z" range={[60, 200]} />
                <ScatterTooltip content={<ScatterChartTooltip />} />
                {scatterData.map((entry) => (
                  <Scatter
                    key={entry.name}
                    name={entry.name}
                    data={[entry]}
                    fill={entry.color}
                    fillOpacity={0.8}
                    stroke={entry.color}
                    strokeWidth={1}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ─── Strategy Descriptions ─── */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {activeStrategyData.filter((s) => visibleStrategies.has(s.name)).map((s) => (
            <div
              key={s.name}
              className="flex items-center gap-2 rounded-md border border-[#1e293b]/40 bg-[#0a0e17]/40 px-2.5 py-1.5"
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: s.color,
                  boxShadow: `0 0 4px ${s.color}40`,
                }}
              />
              <div>
                <span className="font-mono text-[10px] font-bold" style={{ color: s.color }}>
                  {s.name}
                </span>
                <p className="text-[9px] text-[#64748b] leading-tight">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
