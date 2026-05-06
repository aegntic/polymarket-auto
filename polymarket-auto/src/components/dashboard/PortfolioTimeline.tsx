'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, ArrowUpRight, ArrowDownRight, Trophy, AlertTriangle, Clock } from 'lucide-react'
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts'

type Period = '7D' | '30D' | '90D' | 'ALL'

// Seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface TimelinePoint {
  day: number
  value: number
  gainValue: number | null
  lossValue: number | null
  date: string
}

function generateTimelineData(): TimelinePoint[] {
  const rng = mulberry32(42)
  const startCapital = 25
  const points: TimelinePoint[] = []
  let value = startCapital

  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() - 90)

  for (let day = 0; day <= 90; day++) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + day)

    if (day === 0) {
      value = startCapital
    } else if (day >= 45 && day <= 55) {
      // Drawdown period: 15-20% dip from running peak
      const drawdownProgress = (day - 45) / 10
      const drawdownSeverity = Math.sin(drawdownProgress * Math.PI) // peaks in middle
      const noise = (rng() - 0.5) * value * 0.02
      value = value * (1 - 0.025 * drawdownSeverity) + noise
    } else if (day > 55 && day <= 62) {
      // Recovery period
      const recoveryProgress = (day - 55) / 7
      const noise = (rng() - 0.5) * value * 0.015
      value = value * (1 + 0.04 * recoveryProgress) + noise
    } else {
      // Exponential growth with noise
      const growthRate = 1 + 0.035 + (rng() - 0.45) * 0.04
      value = value * Math.max(0.95, growthRate)
    }

    value = Math.max(startCapital * 0.5, value) // Floor at 50% of start

    const isGain = value >= startCapital
    points.push({
      day,
      value: Math.round(value * 100) / 100,
      gainValue: isGain ? value : null,
      lossValue: isGain ? null : value,
      date: date.toISOString().split('T')[0],
    })
  }

  // Ensure final value is close to dashboard's currentCapital (~4237)
  const finalTarget = 4237.5
  const lastValue = points[points.length - 1].value
  const scaleFactor = finalTarget / lastValue
  for (const p of points) {
    p.value = Math.round(p.value * scaleFactor * 100) / 100
    const isGain = p.value >= startCapital
    p.gainValue = isGain ? p.value : null
    p.lossValue = isGain ? null : p.value
  }

  return points
}

const DATA = generateTimelineData()
const START_CAPITAL = 25

interface MilestoneMarker {
  day: number
  value: number
  label: string
  color: string
  description: string
}

function computeMilestones(data: TimelinePoint[]): MilestoneMarker[] {
  const milestones: MilestoneMarker[] = []

  // Agent deployed (first data point)
  milestones.push({
    day: data[0].day,
    value: data[0].value,
    label: 'Deployed',
    color: '#22d3ee',
    description: 'Agent deployed with $25 starting capital',
  })

  // First profit (first day above starting capital + 10%)
  const profitThreshold = START_CAPITAL * 1.1
  const firstProfit = data.find((p) => p.value >= profitThreshold)
  if (firstProfit) {
    milestones.push({
      day: firstProfit.day,
      value: firstProfit.value,
      label: 'First Profit',
      color: '#00ff41',
      description: `First 10%+ profit: $${firstProfit.value.toFixed(2)}`,
    })
  }

  // Peak value
  let peakIdx = 0
  for (let i = 1; i < data.length; i++) {
    if (data[i].value > data[peakIdx].value) peakIdx = i
  }
  milestones.push({
    day: data[peakIdx].day,
    value: data[peakIdx].value,
    label: 'Peak',
    color: '#f59e0b',
    description: `Peak value: $${data[peakIdx].value.toFixed(2)} on Day ${data[peakIdx].day}`,
  })

  // Max drawdown (worst peak-to-trough decline)
  let maxDrawdown = 0
  let drawdownDay = 0
  let drawdownValue = 0
  let peakSoFar = data[0].value
  for (let i = 1; i < data.length; i++) {
    if (data[i].value > peakSoFar) peakSoFar = data[i].value
    const dd = (peakSoFar - data[i].value) / peakSoFar
    if (dd > maxDrawdown) {
      maxDrawdown = dd
      drawdownDay = i
      drawdownValue = data[i].value
    }
  }
  milestones.push({
    day: drawdownDay,
    value: drawdownValue,
    label: 'Max DD',
    color: '#ef4444',
    description: `Max drawdown: -${(maxDrawdown * 100).toFixed(1)}% ($${drawdownValue.toFixed(2)})`,
  })

  return milestones
}

const MILESTONES = computeMilestones(DATA)

function filterByPeriod(data: TimelinePoint[], period: Period): TimelinePoint[] {
  if (period === 'ALL') return data
  const days = period === '7D' ? 7 : period === '30D' ? 30 : 90
  return data.slice(-days - 1)
}

export function PortfolioTimeline() {
  const [period, setPeriod] = useState<Period>('90D')

  const filteredData = useMemo(() => filterByPeriod(DATA, period), [period])

  const currentValue = DATA[DATA.length - 1].value
  const peakValue = Math.max(...DATA.map((d) => d.value))
  const peakDay = DATA.find((d) => d.value === peakValue)?.day ?? 0

  // Compute max drawdown
  let maxDrawdown = 0
  let maxDrawdownDay = 0
  let peakSoFar = DATA[0].value
  for (let i = 1; i < DATA.length; i++) {
    if (DATA[i].value > peakSoFar) peakSoFar = DATA[i].value
    const dd = (peakSoFar - DATA[i].value) / peakSoFar
    if (dd > maxDrawdown) {
      maxDrawdown = dd
      maxDrawdownDay = i
    }
  }

  const daysSinceDrawdown = DATA.length - 1 - maxDrawdownDay
  const isInDrawdown = maxDrawdownDay === DATA.length - 1

  const returnMultiple = (currentValue / START_CAPITAL).toFixed(0)

  const periods: Period[] = ['7D', '30D', '90D', 'ALL']

  // Filter milestones to only show ones within the selected period
  const filteredMilestones = useMemo(() => {
    if (period === 'ALL') return MILESTONES
    const days = period === '7D' ? 7 : period === '30D' ? 30 : 90
    const minDay = DATA[DATA.length - 1].day - days
    return MILESTONES.filter((m) => m.day >= minDay)
  }, [period])

  return (
    <Card className="card-accent-green rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
      <CardHeader className="pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <TrendingUp className="h-4 w-4 text-[#00ff41]" />
            <span className="card-title-cyber">PORTFOLIO VALUE TIMELINE</span>
            <span className="text-[9px] font-normal text-[#64748b]">
              90-day value progression
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="animate-return-glow font-mono text-sm font-bold text-[#00ff41]">
              {returnMultiple}x
            </span>
            {/* Period Selector */}
            <div className="flex items-center gap-0.5 rounded-lg border border-[#1e293b] bg-[#0a0e17]/80 p-0.5">
              {periods.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-2 py-0.5 text-[9px] font-bold transition-all ${
                    period === p
                      ? 'bg-[#00ff41]/12 text-[#00ff41] border-b border-[#00ff41]/50'
                      : 'text-[#64748b] hover:text-[#94a3b8]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 pt-0">
        {/* Mini Area Chart */}
        <div className="h-[120px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={filteredData}
              margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="ptGainGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ff41" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#00ff41" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="ptLossGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f1724',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  fontSize: '10px',
                  color: '#e2e8f0',
                  padding: '6px 10px',
                }}
                labelFormatter={(_val, payload) => {
                  const item = payload?.[0]?.payload as TimelinePoint | undefined
                  return item?.date ?? `Day ${_val}`
                }}
                formatter={(value: number | null, name: string) => {
                  if (value === null) return [null, null]
                  const label = name === 'gainValue' ? 'Value (Gain)' : name === 'lossValue' ? 'Value (Drawdown)' : 'Value'
                  return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, label]
                }}
              />
              {/* Reference line at starting capital */}
              <ReferenceLine
                y={START_CAPITAL}
                stroke="#64748b"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
                strokeWidth={1}
              />
              {/* Loss area (red) - rendered first so gain overlaps */}
              <Area
                type="monotone"
                dataKey="lossValue"
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeOpacity={0.6}
                fill="url(#ptLossGradient)"
                dot={false}
                connectNulls={false}
              />
              {/* Gain area (green) */}
              <Area
                type="monotone"
                dataKey="gainValue"
                stroke="#00ff41"
                strokeWidth={1.5}
                fill="url(#ptGainGradient)"
                dot={false}
                connectNulls={false}
                activeDot={{
                  r: 3,
                  fill: '#00ff41',
                  stroke: '#0f1724',
                  strokeWidth: 2,
                }}
              />
              {/* Milestone markers */}
              {filteredMilestones.map((m) => {
                const dataPoint = filteredData.find((d) => d.day === m.day)
                if (!dataPoint) return null
                return (
                  <ReferenceDot
                    key={m.label}
                    x={dataPoint.day}
                    y={dataPoint.value}
                    r={3}
                    fill={m.color}
                    stroke="#0f1724"
                    strokeWidth={2}
                  />
                )
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Milestone legend */}
        <div className="mb-2 flex flex-wrap items-center gap-3">
          {MILESTONES.map((m) => (
            <div key={m.label} className="flex items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              <span className="text-[8px] text-[#64748b]">{m.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <span className="h-px w-4 border-t border-dashed border-[#64748b]" />
            <span className="text-[8px] text-[#64748b]">Start ($25)</span>
          </div>
        </div>

        {/* Divider */}
        <div className="section-divider" />

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-[#1e293b]/40 bg-[#0a0e17]/50 px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <Trophy className="h-2.5 w-2.5 text-[#f59e0b]" />
              <span className="text-[8px] font-medium uppercase tracking-wider text-[#64748b]">Peak Value</span>
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-[#f59e0b]">
              ${peakValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[8px] text-[#64748b]">Day {peakDay}</div>
          </div>

          <div className="rounded-lg border border-[#1e293b]/40 bg-[#0a0e17]/50 px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-2.5 w-2.5 text-[#00ff41]" />
              <span className="text-[8px] font-medium uppercase tracking-wider text-[#64748b]">Current Value</span>
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-[#00ff41] glow-green">
              ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[8px] text-[#00ff41]/60">
              +{((currentValue / START_CAPITAL - 1) * 100).toFixed(0)}% all-time
            </div>
          </div>

          <div className="rounded-lg border border-[#1e293b]/40 bg-[#0a0e17]/50 px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <ArrowDownRight className="h-2.5 w-2.5 text-[#ef4444]" />
              <span className="text-[8px] font-medium uppercase tracking-wider text-[#64748b]">Max Drawdown</span>
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-[#ef4444]">
              -{(maxDrawdown * 100).toFixed(1)}%
            </div>
            <div className="text-[8px] text-[#64748b]">Day {maxDrawdownDay}</div>
          </div>

          <div className="rounded-lg border border-[#1e293b]/40 bg-[#0a0e17]/50 px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5 text-[#22d3ee]" />
              <span className="text-[8px] font-medium uppercase tracking-wider text-[#64748b]">Recovery</span>
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-[#22d3ee]">
              {isInDrawdown ? (
                <span className="text-[#ef4444]">In drawdown</span>
              ) : (
                <>{daysSinceDrawdown}d since max DD</>
              )}
            </div>
            <div className="text-[8px] text-[#64748b]">
              {isInDrawdown ? 'Still recovering' : 'Fully recovered'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
