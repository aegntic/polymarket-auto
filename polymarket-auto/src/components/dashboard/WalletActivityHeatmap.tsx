'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Clock, Users, Award } from 'lucide-react'
import { useDashboardStore, type Trade } from '@/lib/store'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21]

function getCellColorClass(value: number, max: number): string {
  if (value === 0) return 'bg-[#0f1724]'
  const ratio = max > 0 ? value / max : 0
  if (ratio <= 0.15) return 'bg-[#00ff41]/15'
  if (ratio <= 0.35) return 'bg-[#00ff41]/30'
  if (ratio <= 0.6) return 'bg-[#00ff41]/50'
  return 'bg-[#00ff41]/70'
}

function getDayOfWeekIndex(dateStr: string): number {
  const d = new Date(dateStr)
  const jsDay = d.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

interface TooltipData {
  day: string
  hour: number
  count: number
}

export function WalletActivityHeatmap() {
  const [edgeOnly, setEdgeOnly] = useState(false)
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  const { data: apiTrades, isLoading, error } = useQuery<Trade[]>({
    queryKey: ['trades'],
    queryFn: () => fetch('/api/trades').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const liveTrades = useDashboardStore((s) => s.liveTrades)

  // Merge live + API trades, deduplicate
  const allTrades = useMemo(() => {
    const seen = new Set<string>()
    const result: Trade[] = []
    for (const t of liveTrades) {
      if (!seen.has(t.id)) {
        seen.add(t.id)
        result.push(t)
      }
    }
    for (const t of apiTrades ?? []) {
      if (!seen.has(t.id)) {
        seen.add(t.id)
        result.push(t)
      }
    }
    return result
  }, [liveTrades, apiTrades])

  // Build heatmap from real trade data only
  const { heatmapData, maxValue, stats } = useMemo(() => {
    // Start with zeros
    const data: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))

    // Overlay real trade data
    for (const trade of allTrades) {
      if (edgeOnly && trade.wallet && !trade.wallet.isEdgeTrader) continue
      const dayIdx = getDayOfWeekIndex(trade.createdAt)
      const hour = new Date(trade.createdAt).getHours()
      if (dayIdx >= 0 && dayIdx < 7 && hour >= 0 && hour < 24) {
        data[dayIdx][hour] += 1
      }
    }

    // Find max value
    let max = 0
    let totalCount = 0
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (data[d][h] > max) max = data[d][h]
        totalCount += data[d][h]
      }
    }

    const hourTotals = Array(24).fill(0)
    for (let h = 0; h < 24; h++) {
      for (let d = 0; d < 7; d++) {
        hourTotals[h] += data[d][h]
      }
    }
    const peakHour = hourTotals.indexOf(Math.max(...hourTotals))

    const dayTotals = Array(7).fill(0)
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        dayTotals[d] += data[d][h]
      }
    }
    const peakDayIdx = dayTotals.indexOf(Math.max(...dayTotals))

    const allValues = data.flat().sort((a, b) => b - a)
    const top20Count = Math.ceil(allValues.length * 0.2)
    const top20Sum = allValues.slice(0, top20Count).reduce((a, b) => a + b, 0)
    const concentration = totalCount > 0 ? (top20Sum / totalCount) * 100 : 0

    return {
      heatmapData: data,
      maxValue: max,
      stats: {
        peakHour,
        peakDay: DAYS[peakDayIdx],
        totalActivity: totalCount,
        concentration: Math.round(concentration),
      },
    }
  }, [allTrades, edgeOnly])

  const handleCellHover = useCallback(
    (dayIdx: number, hour: number, event: React.MouseEvent) => {
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      const parentRect = (event.target as HTMLElement)
        .closest('.heatmap-container')
        ?.getBoundingClientRect()
      if (parentRect) {
        setTooltip({
          day: DAYS[dayIdx],
          hour,
          count: heatmapData[dayIdx][hour],
        })
      }
    },
    [heatmapData]
  )

  const handleCellLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  if (error) {
    return (
      <Card className="card-accent-cyan rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="card-title-cyber flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            WALLET ACTIVITY HEATMAP
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load trade data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-cyan rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="card-title-cyber flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              WALLET ACTIVITY HEATMAP
            </CardTitle>
            <p className="mt-1 text-[10px] text-[#64748b]">Trading activity by hour and day</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEdgeOnly(false)}
              className={`rounded-md px-2.5 py-1 text-[9px] font-semibold tracking-wide transition-all duration-200 ${
                !edgeOnly
                  ? 'bg-cyan-400/15 text-cyan-400 border border-cyan-400/30'
                  : 'text-[#64748b] border border-transparent hover:text-[#94a3b8]'
              }`}
            >
              <Users className="mr-1 inline-block h-3 w-3" />
              All Wallets
            </button>
            <button
              onClick={() => setEdgeOnly(true)}
              className={`rounded-md px-2.5 py-1 text-[9px] font-semibold tracking-wide transition-all duration-200 ${
                edgeOnly
                  ? 'bg-[#00ff41]/15 text-[#00ff41] border border-[#00ff41]/30'
                  : 'text-[#64748b] border border-transparent hover:text-[#94a3b8]'
              }`}
            >
              <Award className="mr-1 inline-block h-3 w-3" />
              Edge Traders Only
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full bg-[#1e293b]/50" />
            ))}
          </div>
        ) : (
          <>
            <div className="heatmap-container relative overflow-x-auto pb-1">
              <div className="grid gap-[2px] pl-[30px]" style={{ gridTemplateColumns: `repeat(24, 16px)` }}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className={`text-center text-[8px] text-[#64748b] ${HOUR_LABELS.includes(h) ? 'opacity-100' : 'opacity-0'}`}
                  >
                    {HOUR_LABELS.includes(h) ? h : ''}
                  </div>
                ))}
              </div>

              <div className="space-y-[2px]">
                {DAYS.map((day, dayIdx) => (
                  <div key={day} className="flex items-center gap-0">
                    <div className="w-[30px] shrink-0 text-[9px] text-[#64748b] text-right pr-1.5">{day}</div>
                    <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(24, 16px)` }}>
                      {HOURS.map((hour) => {
                        const value = heatmapData[dayIdx][hour]
                        return (
                          <div
                            key={`${dayIdx}-${hour}`}
                            className={`h-4 w-4 rounded-[2px] ${getCellColorClass(value, maxValue)} transition-transform duration-150 hover:scale-[1.3] hover:z-10 cursor-pointer hover:ring-1 hover:ring-cyan-400/40`}
                            onMouseEnter={(e) => handleCellHover(dayIdx, hour, e)}
                            onMouseLeave={handleCellLeave}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {tooltip && (
                <div
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-[#1e293b] bg-[#0a0e17]/95 px-2 py-1.5 shadow-lg backdrop-blur-sm"
                  style={{ left: '50%', top: '50%' }}
                >
                  <div className="text-[9px] font-mono text-cyan-400">
                    {tooltip.day} {tooltip.hour}:00-{tooltip.hour + 1 > 23 ? 0 : tooltip.hour + 1}:00
                  </div>
                  <div className="text-[10px] font-mono text-[#e2e8f0]">
                    {tooltip.count} trade{tooltip.count !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[#64748b]">Less</span>
                <div className="flex h-3 gap-[2px]">
                  <div className="h-3 w-4 rounded-[2px] bg-[#0f1724]" />
                  <div className="h-3 w-4 rounded-[2px] bg-[#00ff41]/15" />
                  <div className="h-3 w-4 rounded-[2px] bg-[#00ff41]/30" />
                  <div className="h-3 w-4 rounded-[2px] bg-[#00ff41]/50" />
                  <div className="h-3 w-4 rounded-[2px] bg-[#00ff41]/70" />
                </div>
                <span className="text-[9px] text-[#64748b]">More</span>
              </div>
              <span className="text-[9px] text-[#334155]">
                {edgeOnly ? 'Edge traders only' : 'All wallets'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-[#1e293b] bg-[#0a0e17]/80 px-3 py-2.5">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-[9px] text-[#64748b]">Peak Hour</div>
                  <div className="font-mono text-xs font-bold text-cyan-400 glow-cyan">{stats.peakHour}:00 UTC</div>
                </div>
                <div className="h-8 w-px bg-[#1e293b]" />
                <div>
                  <div className="text-[9px] text-[#64748b]">Peak Day</div>
                  <div className="font-mono text-xs font-bold text-[#00ff41]">{stats.peakDay}</div>
                </div>
                <div className="h-8 w-px bg-[#1e293b]" />
                <div>
                  <div className="text-[9px] text-[#64748b]">Total Activity</div>
                  <div className="font-mono text-xs font-bold text-[#e2e8f0]">{stats.totalActivity.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
