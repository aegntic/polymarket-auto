'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Grid3x3 } from 'lucide-react'
import { useDashboardStore, type Trade } from '@/lib/store'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const TIME_PERIODS = [
  { key: 'morning', label: 'Morning', range: '6-12', startHour: 6, endHour: 12 },
  { key: 'afternoon', label: 'Afternoon', range: '12-18', startHour: 12, endHour: 18 },
  { key: 'evening', label: 'Evening', range: '18-24', startHour: 18, endHour: 24 },
  { key: 'night', label: 'Night', range: '0-6', startHour: 0, endHour: 6 },
] as const

type DayKey = (typeof DAYS)[number]
type PeriodKey = (typeof TIME_PERIODS)[number]['key']

interface HeatmapCell {
  pnl: number
  count: number
}

function getTimePeriod(hour: number): PeriodKey {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 24) return 'evening'
  return 'night'
}

function getDayOfWeek(dateStr: string): DayKey {
  const days: DayKey[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const d = new Date(dateStr)
  // getDay() returns 0=Sun, 1=Mon, ... 6=Sat
  // We need Mon=0, Sun=6
  const jsDay = d.getDay()
  const idx = jsDay === 0 ? 6 : jsDay - 1
  return days[idx]
}

function getCellColor(pnl: number, maxAbsPnl: number): string {
  if (pnl === 0 || maxAbsPnl === 0) return 'bg-[#1e293b]/30'

  const intensity = Math.min(Math.abs(pnl) / maxAbsPnl, 1)
  const opacity = 0.15 + intensity * 0.75

  if (pnl > 0) {
    // Green shades
    return `rgba(0, 255, 65, ${opacity})`
  } else {
    // Red shades
    return `rgba(239, 68, 68, ${opacity})`
  }
}

function getCellTextColor(pnl: number): string {
  if (pnl > 0) return '#00ff41'
  if (pnl < 0) return '#ef4444'
  return '#64748b'
}

export function PnLHeatmap() {
  const allTrades = useDashboardStore((s) => s.liveTrades)

  // Build heatmap data
  const { heatmap, maxAbsPnl, totalPnl, totalTrades, profitTrades, lossTrades } = useMemo(() => {
    const map = new Map<string, HeatmapCell>()

    // Initialize all cells
    for (const day of DAYS) {
      for (const period of TIME_PERIODS) {
        map.set(`${day}-${period.key}`, { pnl: 0, count: 0 })
      }
    }

    let totalPnl = 0
    let profitCount = 0
    let lossCount = 0

    for (const trade of allTrades) {
      if (trade.pnl === null) continue
      const day = getDayOfWeek(trade.createdAt)
      const date = new Date(trade.createdAt)
      const period = getTimePeriod(date.getHours())
      const key = `${day}-${period}`

      const cell = map.get(key)
      if (cell) {
        cell.pnl += trade.pnl
        cell.count += 1
      }

      totalPnl += trade.pnl
      if (trade.pnl >= 0) profitCount++
      else lossCount++
    }

    // Find max absolute P&L for color scaling
    let maxAbs = 0
    for (const cell of map.values()) {
      if (Math.abs(cell.pnl) > maxAbs) maxAbs = Math.abs(cell.pnl)
    }

    return {
      heatmap: map,
      maxAbsPnl: maxAbs,
      totalPnl,
      totalTrades: allTrades.filter((t) => t.pnl !== null).length,
      profitTrades: profitCount,
      lossTrades: lossCount,
    }
  }, [allTrades])

  if (!allTrades || allTrades.length === 0) {
    return (
      <Card className="card-accent-green border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Grid3x3 className="h-4 w-4 text-[#00ff41]" />
            P&L HEATMAP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load trade data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-green border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <Grid3x3 className="h-4 w-4 text-[#00ff41]" />
          P&L HEATMAP
          <span className="ml-auto text-[10px] text-[#64748b]">
            {totalTrades} trades with P&L
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {allTrades.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-[#1e293b]/50" />
            ))}
          </div>
        ) : (
          <>
            {/* Column Headers */}
            <div className="grid grid-cols-[48px_repeat(4,1fr)] gap-1.5">
              <div />
              {TIME_PERIODS.map((period) => (
                <div
                  key={period.key}
                  className="text-center text-[9px] font-medium text-[#64748b]"
                >
                  <div>{period.label}</div>
                  <div className="text-[8px] text-[#334155]">{period.range}h</div>
                </div>
              ))}
            </div>

            {/* Heatmap Grid */}
            <div className="space-y-1.5">
              {DAYS.map((day) => (
                <div key={day} className="grid grid-cols-[48px_repeat(4,1fr)] gap-1.5">
                  <div className="flex items-center text-[10px] font-medium text-[#64748b]">
                    {day}
                  </div>
                  {TIME_PERIODS.map((period) => {
                    const cell = heatmap.get(`${day}-${period.key}`)
                    const pnl = cell?.pnl ?? 0
                    const count = cell?.count ?? 0
                    const bgColor = getCellColor(pnl, maxAbsPnl)
                    const textColor = getCellTextColor(pnl)

                    return (
                      <div
                        key={`${day}-${period.key}`}
                        className="flex min-h-[38px] flex-col items-center justify-center rounded-md border border-[#1e293b]/60 px-1 py-1.5 transition-colors"
                        style={{ backgroundColor: bgColor }}
                        title={`${day} ${period.label}: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${count} trades)`}
                      >
                        <span
                          className="font-mono text-[11px] font-bold leading-none"
                          style={{ color: textColor }}
                        >
                          {pnl === 0
                            ? '—'
                            : `${pnl >= 0 ? '+' : ''}$${Math.abs(pnl) >= 1000 ? (pnl / 1000).toFixed(1) + 'k' : pnl.toFixed(2)}`}
                        </span>
                        {count > 0 && (
                          <span className="mt-0.5 text-[8px] text-[#64748b]">
                            {count} trade{count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Color Scale Legend */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[#64748b]">Loss</span>
                <div className="flex h-3 w-24 overflow-hidden rounded-sm">
                  <div className="flex-1" style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)' }} />
                  <div className="flex-1" style={{ backgroundColor: 'rgba(239, 68, 68, 0.6)' }} />
                  <div className="flex-1" style={{ backgroundColor: 'rgba(239, 68, 68, 0.3)' }} />
                  <div className="flex-1" style={{ backgroundColor: 'rgba(30, 41, 59, 0.3)' }} />
                  <div className="flex-1" style={{ backgroundColor: 'rgba(0, 255, 65, 0.3)' }} />
                  <div className="flex-1" style={{ backgroundColor: 'rgba(0, 255, 65, 0.6)' }} />
                  <div className="flex-1" style={{ backgroundColor: 'rgba(0, 255, 65, 0.9)' }} />
                </div>
                <span className="text-[9px] text-[#64748b]">Profit</span>
              </div>
              <span className="text-[9px] text-[#334155]">
                max: ${maxAbsPnl >= 1000 ? (maxAbsPnl / 1000).toFixed(1) + 'k' : maxAbsPnl.toFixed(2)}
              </span>
            </div>

            {/* Total P&L Summary */}
            <div className="flex items-center justify-between rounded-lg border border-[#1e293b] bg-[#0a0e17]/80 px-3 py-2.5">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-[9px] text-[#64748b]">Total P&L</div>
                  <div
                    className={`font-mono text-base font-bold ${
                      totalPnl >= 0 ? 'text-[#00ff41] glow-green' : 'text-[#ef4444]'
                    }`}
                  >
                    {totalPnl >= 0 ? '+' : ''}
                    ${Math.abs(totalPnl) >= 1000 ? (totalPnl / 1000).toFixed(2) + 'k' : totalPnl.toFixed(2)}
                  </div>
                </div>
                <div className="h-8 w-px bg-[#1e293b]" />
                <div>
                  <div className="text-[9px] text-[#64748b]">Winners</div>
                  <div className="font-mono text-xs font-bold text-[#00ff41]">{profitTrades}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#64748b]">Losers</div>
                  <div className="font-mono text-xs font-bold text-[#ef4444]">{lossTrades}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#64748b]">Win Rate</div>
                  <div className="font-mono text-xs font-bold text-[#f59e0b]">
                    {totalTrades > 0
                      ? ((profitTrades / totalTrades) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-[#64748b]">Avg P&L</div>
                <div
                  className={`font-mono text-xs font-bold ${
                    totalTrades > 0 && totalPnl / totalTrades >= 0
                      ? 'text-[#00ff41]'
                      : 'text-[#ef4444]'
                  }`}
                >
                  {totalTrades > 0
                    ? `${totalPnl / totalTrades >= 0 ? '+' : ''}$${(totalPnl / totalTrades).toFixed(2)}`
                    : '—'}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
