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
import { useDashboardStore } from '@/lib/store'

type Period = '7D' | '30D' | '90D' | 'ALL'

const START_CAPITAL = 25

interface TimelinePoint {
  day: number
  value: number
  gainValue: number | null
  lossValue: number | null
  date: string
}

function filterByPeriod(data: TimelinePoint[], period: Period): TimelinePoint[] {
  if (period === 'ALL') return data
  const days = period === '7D' ? 7 : period === '30D' ? 30 : 90
  return data.slice(-days - 1)
}

function computeMilestones(data: TimelinePoint[]): { day: number; value: number; label: string; color: string; description: string }[] {
  const milestones: { day: number; value: number; label: string; color: string; description: string }[] = []

  milestones.push({
    day: data[0].day,
    value: data[0].value,
    label: 'Deployed',
    color: '#22d3ee',
    description: 'Agent deployed with $25 starting capital',
  })

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

export function PortfolioTimeline() {
  const [period, setPeriod] = useState<Period>('90D')

  const walletBalance = useDashboardStore((s) => s.walletBalance)
  const liveCapital = useDashboardStore((s) => s.liveCapital)
  const currentValueStore = walletBalance || liveCapital || 25

  const periods: Period[] = ['7D', '30D', '90D', 'ALL']

  const filteredMilestones = useMemo<{ label: string; color: string }[]>(() => {
    if (period === 'ALL') return []
    const days = period === '7D' ? 7 : period === '30D' ? 30 : 90
    const minDay = 90 - days
    return []
  }, [period])

  const isInDrawdown = false

  const returnMultiple = (currentValueStore / START_CAPITAL).toFixed(0)

  return (
    <Card className="card-accent-green rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
      <CardHeader className="pb-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <TrendingUp className="h-4 w-4 text-[#00ff41]" />
            <span className="card-title-cyber">PORTFOLIO VALUE TIMELINE</span>
            <span className="text-[9px] font-normal text-[#64748b]">
              Connect wallet to see timeline
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="animate-return-glow font-mono text-sm font-bold text-[#00ff41]">
              {returnMultiple}x
            </span>
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
        <div className="h-[120px] w-full flex items-center justify-center text-[#64748b] text-xs">
          Connect wallet to view portfolio timeline
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          {filteredMilestones.map((m) => (
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
        <div className="section-divider" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-[#1e293b]/40 bg-[#0a0e17]/50 px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <Trophy className="h-2.5 w-2.5 text-[#f59e0b]" />
              <span className="text-[8px] font-medium uppercase tracking-wider text-[#64748b]">Peak Value</span>
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-[#f59e0b]">$25.00</div>
            <div className="text-[8px] text-[#64748b]">No data</div>
          </div>
          <div className="rounded-lg border border-[#1e293b]/40 bg-[#0a0e17]/50 px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <ArrowUpRight className="h-2.5 w-2.5 text-[#00ff41]" />
              <span className="text-[8px] font-medium uppercase tracking-wider text-[#64748b]">Current Value</span>
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-[#00ff41] glow-green">
              ${currentValueStore.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[8px] text-[#00ff41]/60">
              {currentValueStore > START_CAPITAL ? '+' : ''}{((currentValueStore / START_CAPITAL - 1) * 100).toFixed(0)}% all-time
            </div>
          </div>
          <div className="rounded-lg border border-[#1e293b]/40 bg-[#0a0e17]/50 px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <ArrowDownRight className="h-2.5 w-2.5 text-[#ef4444]" />
              <span className="text-[8px] font-medium uppercase tracking-wider text-[#64748b]">Max Drawdown</span>
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-[#ef4444]">0.0%</div>
            <div className="text-[8px] text-[#64748b]">No data</div>
          </div>
          <div className="rounded-lg border border-[#1e293b]/40 bg-[#0a0e17]/50 px-2.5 py-1.5">
            <div className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5 text-[#22d3ee]" />
              <span className="text-[8px] font-medium uppercase tracking-wider text-[#64748b]">Recovery</span>
            </div>
            <div className="mt-0.5 font-mono text-xs font-bold text-[#22d3ee]">
              Fully recovered
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
