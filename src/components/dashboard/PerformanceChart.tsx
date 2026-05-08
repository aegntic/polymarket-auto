'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown } from 'lucide-react'
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useDashboardStore } from '@/lib/store'

type TimeRange = '1H' | '4H' | '8H' | 'ALL'

interface PerformancePoint {
  timestamp: string
  capital: number
  trades: number
  drawdown: number
  ma?: number
}

interface PerformanceData {
  series: PerformancePoint[]
  summary: {
    currentCapital: number | null
    capitalBase: number | null
    totalPnl: number
    totalTrades: number
    winRate: number
    sharpeRatio: number | null
    maxDrawdown: number | null
  }
}

function computeMA(data: PerformancePoint[], window = 5): PerformancePoint[] {
  return data.map((point, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = data.slice(start, i + 1)
    const avgCapital = slice.reduce((s, p) => s + p.capital, 0) / slice.length
    return { ...point, ma: avgCapital }
  })
}

function filterByRange(data: PerformancePoint[], range: TimeRange): PerformancePoint[] {
  if (range === 'ALL' || data.length === 0) return data
  const latest = new Date(data[data.length - 1].timestamp).getTime()
  const hours = range === '1H' ? 1 : range === '4H' ? 4 : 8
  const cutoff = latest - hours * 3600000
  return data.filter((p) => new Date(p.timestamp).getTime() >= cutoff)
}

export function PerformanceChart() {
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL')

  const walletBalance = useDashboardStore((s) => s.walletBalance)
  const liveCapital = useDashboardStore((s) => s.liveCapital)
  const actualCapital = walletBalance || liveCapital || 0

  const { data, isLoading, error } = useQuery<PerformanceData>({
    queryKey: ['performance'],
    queryFn: () => fetch('/api/performance').then((r) => r.json()),
    refetchInterval: 60000,
  })

  const series = data?.series ?? []
  const summary = data?.summary

  const filteredData = useMemo(() => {
    if (series.length === 0) return []
    const rangeData = filterByRange(series, timeRange)
    if (rangeData.length === 0) return []

    // Scale data to match actual wallet capital if available
    if (actualCapital > 0 && rangeData.length > 0) {
      const lastPoint = rangeData[rangeData.length - 1]?.capital
      if (lastPoint && lastPoint > 0) {
        const ratio = actualCapital / lastPoint
        const scaled = rangeData.map(p => ({
          ...p,
          capital: p.capital * ratio,
        }))
        return computeMA(scaled)
      }
    }

    return computeMA(rangeData)
  }, [series, timeRange, actualCapital])

  const currentCapital = filteredData.length > 0
    ? filteredData[filteredData.length - 1].capital
    : (actualCapital || summary?.currentCapital || summary?.capitalBase || 0)

  const startCapital = filteredData.length > 0
    ? filteredData[0].capital
    : (summary?.capitalBase || 0)

  const pnlPercent = startCapital > 0
    ? (((currentCapital - startCapital) / startCapital) * 100).toFixed(0)
    : '0'
  const returnMultiple = startCapital > 0 ? (currentCapital / startCapital).toFixed(1) : '0'
  const isPositive = parseFloat(pnlPercent) >= 0

  const ranges: TimeRange[] = ['1H', '4H', '8H', 'ALL']

  return (
    <Card className="card-accent-cyan card-shadow-deep border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-[#00ff41]" />
            ) : (
              <TrendingDown className="h-4 w-4 text-[#ef4444]" />
            )}
            PERFORMANCE
          </CardTitle>
          <div className="flex items-center gap-0.5 rounded-lg border border-[#1e293b] bg-[#0a0e17]/80 p-0.5">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`rounded-md px-2.5 py-0.5 text-[10px] font-bold transition-all ${
                  timeRange === r
                    ? 'time-filter-active'
                    : 'time-filter-inactive'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1 flex min-w-0 items-end justify-between overflow-hidden">
          <div className="min-w-0">
            <div className={`font-mono text-lg font-bold ${isPositive ? 'text-[#00ff41] glow-green' : 'text-[#ef4444]'}`}>
              ${currentCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-[#64748b]">
              {startCapital > 0 ? (
                <>Starting: ${startCapital.toFixed(2)} ·{' '}
                <span className={isPositive ? 'text-[#00ff41]' : 'text-[#ef4444]'}>
                  {isPositive ? '+' : ''}{pnlPercent}%
                </span></>
              ) : (
                'Connect wallet to track performance'
              )}
            </div>
          </div>
          {startCapital > 0 && (
            <span className={`font-mono text-xl font-bold ${isPositive ? 'text-[#00ff41]' : 'text-[#ef4444]'}`}>
              {returnMultiple}x
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex h-[260px] items-center justify-center">
            <p className="text-xs text-[#ef4444]">Failed to load performance data</p>
          </div>
        ) : isLoading ? (
          <Skeleton className="h-[260px] w-full bg-[#1e293b]/50" />
        ) : filteredData.length > 1 ? (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={filteredData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="capitalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00ff41" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00ff41" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  strokeOpacity={0.4}
                  vertical={false}
                />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(val) => {
                    const d = new Date(val)
                    return `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`
                  }}
                  stroke="#334155"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(val) =>
                    val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val}`
                  }
                  stroke="#334155"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f1724',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#e2e8f0',
                    padding: '8px 12px',
                  }}
                  labelFormatter={(val) => {
                    const d = new Date(val)
                    return d.toLocaleTimeString()
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'ma') return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Moving Avg']
                    if (name === 'drawdown') return [`${(value * 100).toFixed(1)}%`, 'Drawdown']
                    return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Capital']
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeOpacity={0.3}
                  fill="url(#drawdownGradient)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="capital"
                  stroke="#00ff41"
                  strokeWidth={2}
                  fill="url(#capitalGradient)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: '#00ff41',
                    stroke: '#0f1724',
                    strokeWidth: 2,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="ma"
                  stroke="#22d3ee"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-[#64748b]">
            <TrendingUp className="h-8 w-8 opacity-30" />
            <p className="text-xs">No trade data yet</p>
            <p className="text-[10px]">Performance chart will appear after your first trade</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
