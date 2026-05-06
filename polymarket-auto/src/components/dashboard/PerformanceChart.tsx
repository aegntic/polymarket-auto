'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp } from 'lucide-react'
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  Label,
} from 'recharts'
import type { PerformancePoint } from '@/lib/store'

type TimeRange = '1H' | '4H' | '8H' | 'ALL'

const MILESTONES = [
  { capital: 50, label: '2x', color: '#f59e0b' },
  { capital: 250, label: '10x', color: '#00ff41' },
  { capital: 1250, label: '50x', color: '#22d3ee' },
  { capital: 4237, label: '169x', color: '#00ff41' },
]

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

  const { data: performance, isLoading, error } = useQuery<PerformancePoint[]>({
    queryKey: ['performance'],
    queryFn: () => fetch('/api/performance').then((r) => r.json()),
    refetchInterval: 60000,
  })

  const currentCapital = performance?.[performance.length - 1]?.capital ?? 0
  const startCapital = performance?.[0]?.capital ?? 25
  const pnlPercent =
    startCapital > 0
      ? (((currentCapital - startCapital) / startCapital) * 100).toFixed(0)
      : '0'
  const returnMultiple =
    startCapital > 0 ? (currentCapital / startCapital).toFixed(1) : '0'

  const filteredData = useMemo(() => {
    if (!performance) return []
    const rangeData = filterByRange(performance, timeRange)
    return computeMA(rangeData)
  }, [performance, timeRange])

  const ranges: TimeRange[] = ['1H', '4H', '8H', 'ALL']

  return (
    <Card className="card-accent-cyan card-shadow-deep border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <TrendingUp className="h-4 w-4 text-[#00ff41]" />
            PERFORMANCE
          </CardTitle>
          {/* Time Range Selector */}
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
            <div className="font-mono text-lg font-bold text-[#00ff41] glow-green">
              ${currentCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-[#64748b]">
              Starting: ${startCapital.toFixed(2)} ·{' '}
              <span className="text-[#00ff41]">+{pnlPercent}%</span>
            </div>
          </div>
          <span className="animate-return-glow font-mono text-xl font-bold text-[#00ff41]">
            {returnMultiple}x
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-xs text-red-400">Failed to load performance data</p>
        ) : isLoading ? (
          <Skeleton className="h-[260px] w-full bg-[#1e293b]/50" />
        ) : filteredData.length > 0 ? (
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
                {/* Chart title inside chart area */}
                <text x="20" y="20" fill="#64748b" fontSize={11} fontFamily="monospace" opacity={0.6}>
                  Capital Over Time
                </text>
                {/* Milestone Reference Lines */}
                {MILESTONES.map((milestone) => {
                  const dataPoint = filteredData.find(
                    (p) => Math.abs(p.capital - milestone.capital) < milestone.capital * 0.15
                  )
                  if (!dataPoint) return null
                  return (
                    <ReferenceLine
                      key={milestone.label}
                      x={dataPoint.timestamp}
                      stroke={milestone.color}
                      strokeDasharray="3 3"
                      strokeOpacity={0.4}
                    >
                      <Label
                        value={milestone.label}
                        position="top"
                        fill={milestone.color}
                        fontSize={9}
                        opacity={0.7}
                      />
                    </ReferenceLine>
                  )
                })}
                {/* Drawdown Area */}
                <Area
                  type="monotone"
                  dataKey="drawdown"
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeOpacity={0.3}
                  fill="url(#drawdownGradient)"
                  dot={false}
                />
                {/* Main Capital Area */}
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
                {/* Moving Average Line */}
                <Line
                  type="monotone"
                  dataKey="ma"
                  stroke="#22d3ee"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={false}
                />
                {/* Milestone Dots */}
                {MILESTONES.map((milestone) => {
                  const dataPoint = filteredData.find(
                    (p) => Math.abs(p.capital - milestone.capital) < milestone.capital * 0.15
                  )
                  if (!dataPoint) return null
                  return (
                    <ReferenceDot
                      key={`dot-${milestone.label}`}
                      x={dataPoint.timestamp}
                      y={dataPoint.capital}
                      r={3}
                      fill={milestone.color}
                      stroke="#0f1724"
                      strokeWidth={2}
                    />
                  )
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-[#64748b]">
            No performance data
          </p>
        )}
      </CardContent>
    </Card>
  )
}
