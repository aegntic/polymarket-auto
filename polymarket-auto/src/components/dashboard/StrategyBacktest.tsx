'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  FlaskConical,
  Play,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Activity,
  Trophy,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────

type StrategyKey =
  | 'kelly'
  | 'fixed_fractional'
  | 'martingale'
  | 'anti_martingale'
  | 'edge_following'

interface StrategyOption {
  key: StrategyKey
  label: string
  description: string
}

interface BacktestPoint {
  round: number
  strategy: number
  baseline: number
}

interface BacktestMetrics {
  totalReturn: number
  maxDrawdown: number
  sharpeRatio: number
  winRate: number
  totalTrades: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STRATEGIES: StrategyOption[] = [
  {
    key: 'kelly',
    label: 'Kelly Criterion',
    description: 'Optimal fraction sizing based on edge',
  },
  {
    key: 'fixed_fractional',
    label: 'Fixed Fractional',
    description: 'Always bets 10% of current bankroll',
  },
  {
    key: 'martingale',
    label: 'Martingale',
    description: 'Doubles after each loss, resets after win',
  },
  {
    key: 'anti_martingale',
    label: 'Anti-Martingale',
    description: 'Doubles after each win, resets after loss',
  },
  {
    key: 'edge_following',
    label: 'Edge Following',
    description: 'Varies sizing based on simulated edge detection',
  },
]

const WIN_PROB = 0.65
const ODDS = 2.0
const ROUNDS = 100
const STARTING_BANKROLL = 1000

// ─── Simulation Logic ────────────────────────────────────────────────────────

/** Seeded PRNG for deterministic results within a single backtest run */
function createRNG(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function simulateStrategy(
  strategyKey: StrategyKey,
  rng: () => number,
  rounds: number,
  startingBankroll: number
): { equity: number[]; wins: boolean[] } {
  const bankroll = startingBankroll
  const equity: number[] = [bankroll]
  const wins: boolean[] = []

  let currentBankroll = bankroll
  let martingaleMultiplier = 1

  for (let i = 0; i < rounds; i++) {
    const isWin = rng() < WIN_PROB
    wins.push(isWin)

    let fraction: number

    switch (strategyKey) {
      case 'kelly': {
        // Kelly fraction: f* = (bp - q) / b where b = odds-1, p = win prob, q = 1-p
        const b = ODDS - 1
        const kelly = (b * WIN_PROB - (1 - WIN_PROB)) / b
        fraction = Math.max(kelly, 0)
        break
      }
      case 'fixed_fractional': {
        fraction = 0.10
        break
      }
      case 'martingale': {
        fraction = 0.05 * martingaleMultiplier
        if (isWin) {
          martingaleMultiplier = 1
        } else {
          martingaleMultiplier = Math.min(martingaleMultiplier * 2, 32)
        }
        break
      }
      case 'anti_martingale': {
        fraction = 0.05 * martingaleMultiplier
        if (isWin) {
          martingaleMultiplier = Math.min(martingaleMultiplier * 2, 16)
        } else {
          martingaleMultiplier = 1
        }
        break
      }
      case 'edge_following': {
        // Simulate edge detection: randomly vary between 0.5x and 0.8x Kelly
        const kelly = ((ODDS - 1) * WIN_PROB - (1 - WIN_PROB)) / (ODDS - 1)
        const edgeMultiplier = 0.5 + rng() * 0.3 // 0.5-0.8
        fraction = Math.max(kelly * edgeMultiplier, 0)
        break
      }
    }

    // Cap fraction to avoid going all-in
    fraction = Math.min(fraction, 0.95)

    const betAmount = currentBankroll * fraction
    const pnl = isWin ? betAmount * (ODDS - 1) : -betAmount
    currentBankroll = Math.max(currentBankroll + pnl, 0.01)

    equity.push(currentBankroll)
  }

  return { equity, wins }
}

function simulateBaseline(
  rng: () => number,
  rounds: number,
  startingBankroll: number
): number[] {
  // Buy & Hold: invest 100% at start, each round the market goes up or down
  const equity: number[] = [startingBankroll]
  let value = startingBankroll

  for (let i = 0; i < rounds; i++) {
    const isWin = rng() < WIN_PROB
    // Simulate market return: win = +5%, loss = -3%
    const marketReturn = isWin ? 0.05 : -0.03
    value = value * (1 + marketReturn)
    equity.push(value)
  }

  return equity
}

function computeMetrics(
  equity: number[],
  wins: boolean[],
  startingBankroll: number
): BacktestMetrics {
  const finalEquity = equity[equity.length - 1]
  const totalReturn = (finalEquity - startingBankroll) / startingBankroll

  // Max Drawdown
  let peak = equity[0]
  let maxDrawdown = 0
  for (const val of equity) {
    if (val > peak) peak = val
    const dd = (peak - val) / peak
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  // Win Rate
  const winCount = wins.filter(Boolean).length
  const winRate = wins.length > 0 ? winCount / wins.length : 0

  // Sharpe Ratio (annualized assuming 1 round = 1 day)
  const returns: number[] = []
  for (let i = 1; i < equity.length; i++) {
    returns.push((equity[i] - equity[i - 1]) / equity[i - 1])
  }
  const avgReturn = returns.length > 0 ? returns.reduce((s, r) => s + r, 0) / returns.length : 0
  const stdReturn =
    returns.length > 1
      ? Math.sqrt(returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length - 1))
      : 0.001
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(365) : 0

  return {
    totalReturn,
    maxDrawdown,
    sharpeRatio,
    winRate,
    totalTrades: wins.length,
  }
}

// ─── Metric Card Component ───────────────────────────────────────────────────

function BacktestMetric({
  icon: Icon,
  label,
  value,
  color,
  subLabel,
}: {
  icon: React.ElementType
  label: string
  value: string
  color: string
  subLabel?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#1e293b] bg-[#0a0e17] p-2">
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

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

function BacktestTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: number
}) {
  if (!active || !payload) return null
  return (
    <div className="rounded-md border border-[#1e293b] bg-[#0f1724] px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-mono text-[10px] text-[#64748b]">Round {label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4 font-mono">
          <span
            className="text-[10px]"
            style={{ color: entry.color }}
          >
            {entry.dataKey === 'strategy' ? 'Strategy' : 'Buy & Hold'}
          </span>
          <span className="text-[11px] font-bold text-[#e2e8f0]">
            ${entry.value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function StrategyBacktest() {
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyKey>('kelly')
  const [backtestSeed, setBacktestSeed] = useState<number | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const runBacktest = useCallback(() => {
    setIsRunning(true)
    // Brief delay for visual feedback
    setTimeout(() => {
      setBacktestSeed(Date.now())
      setIsRunning(false)
    }, 300)
  }, [])

  // Find selected strategy label
  const selectedLabel = STRATEGIES.find((s) => s.key === selectedStrategy)?.label ?? 'Unknown'

  // Run simulation when seed changes
  const { chartData, metrics, baselineMetrics } = useMemo(() => {
    if (backtestSeed === null) {
      return { chartData: [], metrics: null, baselineMetrics: null }
    }

    const rng = createRNG(backtestSeed)
    // Also need a separate RNG for baseline to keep it consistent
    const rngBaseline = createRNG(backtestSeed + 42)

    const { equity, wins } = simulateStrategy(selectedStrategy, rng, ROUNDS, STARTING_BANKROLL)
    const baselineEquity = simulateBaseline(rngBaseline, ROUNDS, STARTING_BANKROLL)

    const chartData: BacktestPoint[] = equity.map((val, i) => ({
      round: i,
      strategy: parseFloat(val.toFixed(2)),
      baseline: parseFloat(baselineEquity[i].toFixed(2)),
    }))

    const metrics = computeMetrics(equity, wins, STARTING_BANKROLL)
    const baselineWins = Array.from({ length: ROUNDS }, (_, i) => {
      // Re-simulate baseline wins for metrics
      const rng2 = createRNG(backtestSeed + 42)
      for (let j = 0; j < i; j++) rng2()
      return rng2() < WIN_PROB
    })
    const baselineMetrics = computeMetrics(baselineEquity, baselineWins, STARTING_BANKROLL)

    return { chartData, metrics, baselineMetrics }
  }, [backtestSeed, selectedStrategy])

  const hasResults = backtestSeed !== null && metrics !== null

  return (
    <Card className="card-accent-purple border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <FlaskConical className="h-4 w-4 text-[#a78bfa]" />
            STRATEGY BACKTEST
          </span>
          {hasResults && (
            <span className="flex items-center gap-1.5 text-[10px] text-[#64748b]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />
              {selectedLabel} · {ROUNDS} rounds
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Strategy Selector + Run Button */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">
              Strategy
            </label>
            <Select
              value={selectedStrategy}
              onValueChange={(v) => setSelectedStrategy(v as StrategyKey)}
            >
              <SelectTrigger className="h-8 w-full border-[#1e293b] bg-[#0a0e17] text-xs text-[#e2e8f0] [&_svg]:text-[#64748b]">
                <SelectValue placeholder="Select strategy" />
              </SelectTrigger>
              <SelectContent className="border-[#1e293b] bg-[#0f1724]">
                {STRATEGIES.map((s) => (
                  <SelectItem
                    key={s.key}
                    value={s.key}
                    className="text-xs text-[#e2e8f0] focus:bg-[#1e293b] focus:text-[#e2e8f0]"
                  >
                    <div>
                      <div>{s.label}</div>
                      <div className="text-[9px] text-[#64748b]">{s.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={runBacktest}
            disabled={isRunning}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#00ff41]/30 bg-[#00ff41]/10 px-4 py-1.5 text-xs font-bold text-[#00ff41] transition-all hover:bg-[#00ff41]/20 hover:shadow-[0_0_12px_rgba(0,255,65,0.15)] disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Activity className="h-3.5 w-3.5 animate-pulse" />
                RUNNING...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                RUN BACKTEST
              </>
            )}
          </button>
        </div>

        {/* No Results Placeholder */}
        {!hasResults && (
          <div className="flex h-[200px] items-center justify-center rounded-lg border border-[#1e293b]/50 bg-[#0a0e17]/30">
            <div className="text-center">
              <FlaskConical className="mx-auto mb-2 h-8 w-8 text-[#1e293b]" />
              <p className="text-xs text-[#64748b]">Select a strategy and run the backtest</p>
              <p className="text-[10px] text-[#334155]">
                Simulates {ROUNDS} rounds of trading with {WIN_PROB * 100}% win probability at {ODDS.toFixed(1)}x odds
              </p>
            </div>
          </div>
        )}

        {/* Chart */}
        {hasResults && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                Equity Curve
              </h3>
              <div className="flex items-center gap-3 text-[9px] text-[#64748b]">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-0.5 w-3 rounded bg-[#00ff41]" />
                  Strategy
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-0.5 w-3 rounded bg-[#64748b]" />
                  Buy & Hold
                </span>
              </div>
            </div>
            <div className="h-[180px] w-full rounded-lg border border-[#1e293b] bg-[#0a0e17]/40 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="strategyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00ff41" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#00ff41" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="baselineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#64748b" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#64748b" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="round"
                    stroke="#334155"
                    tick={{ fill: '#64748b', fontSize: 8 }}
                    tickLine={false}
                    axisLine={false}
                    interval={19}
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
                  <Tooltip content={<BacktestTooltip />} />
                  <ReferenceLine
                    y={STARTING_BANKROLL}
                    stroke="#334155"
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="baseline"
                    stroke="#64748b"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    fill="url(#baselineGrad)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="strategy"
                    stroke="#00ff41"
                    strokeWidth={1.5}
                    fill="url(#strategyGrad)"
                    dot={false}
                    activeDot={{ r: 3, fill: '#00ff41', stroke: '#0f1724', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        {hasResults && metrics && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <BacktestMetric
              icon={TrendingUp}
              label="Total Return"
              value={`${(metrics.totalReturn * 100).toFixed(1)}%`}
              color={metrics.totalReturn > 0 ? '#00ff41' : '#ef4444'}
              subLabel={
                baselineMetrics
                  ? `vs ${(baselineMetrics.totalReturn * 100).toFixed(1)}% B&H`
                  : undefined
              }
            />
            <BacktestMetric
              icon={TrendingDown}
              label="Max Drawdown"
              value={`${(metrics.maxDrawdown * 100).toFixed(1)}%`}
              color={metrics.maxDrawdown < 0.15 ? '#00ff41' : metrics.maxDrawdown < 0.3 ? '#f59e0b' : '#ef4444'}
              subLabel="Peak to trough"
            />
            <BacktestMetric
              icon={BarChart3}
              label="Sharpe Ratio"
              value={metrics.sharpeRatio.toFixed(2)}
              color={metrics.sharpeRatio > 2 ? '#00ff41' : metrics.sharpeRatio >= 1 ? '#f59e0b' : '#ef4444'}
              subLabel={metrics.sharpeRatio > 2 ? 'Excellent' : metrics.sharpeRatio >= 1 ? 'Acceptable' : 'Poor'}
            />
            <BacktestMetric
              icon={Target}
              label="Win Rate"
              value={`${(metrics.winRate * 100).toFixed(1)}%`}
              color={metrics.winRate >= 0.6 ? '#00ff41' : metrics.winRate >= 0.5 ? '#f59e0b' : '#ef4444'}
              subLabel={`${metrics.totalTrades} trades`}
            />
            <BacktestMetric
              icon={Trophy}
              label="vs Buy & Hold"
              value={
                baselineMetrics
                  ? `${metrics.totalReturn > baselineMetrics.totalReturn ? '+' : ''}${((metrics.totalReturn - baselineMetrics.totalReturn) * 100).toFixed(1)}%`
                  : '-'
              }
              color={
                baselineMetrics && metrics.totalReturn > baselineMetrics.totalReturn
                  ? '#00ff41'
                  : '#ef4444'
              }
              subLabel="Outperformance"
            />
          </div>
        )}

        {/* Strategy Info Box */}
        {hasResults && (
          <div className="rounded-md border border-[#a78bfa]/20 bg-[#a78bfa]/5 px-3 py-2">
            <div className="flex items-start gap-2">
              <FlaskConical className="mt-0.5 h-3 w-3 shrink-0 text-[#a78bfa]" />
              <div className="text-[10px] text-[#94a3b8]">
                <span className="font-bold text-[#a78bfa]">{selectedLabel}</span>:{' '}
                {STRATEGIES.find((s) => s.key === selectedStrategy)?.description}
                {' · '}Starting capital: ${STARTING_BANKROLL.toLocaleString()}
                {' · '}Win prob: {WIN_PROB * 100}% · Odds: {ODDS.toFixed(1)}x
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
