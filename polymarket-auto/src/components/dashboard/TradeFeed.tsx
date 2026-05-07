'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Bot, Clock, Volume2, VolumeX, Filter } from 'lucide-react'
import { useDashboardStore, type Trade } from '@/lib/store'
import { formatDistanceToNow } from 'date-fns'

function TradeSizeSparkline({ trades }: { trades: Trade[] }) {
  const last10 = trades.slice(0, 10).reverse()
  if (last10.length < 2) return null

  const w = 60
  const h = 14
  const max = Math.max(...last10.map((t) => t.size))
  const points = last10
    .map((t, i) => {
      const x = (i / (last10.length - 1)) * w
      const y = h - (t.size / max) * (h - 2) - 1
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={w} height={h} className="shrink-0 opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TradeFeed() {
  const [agentOnly, setAgentOnly] = useState(false)
  const [muted, setMuted] = useState(true)
  const prevCountRef = useRef(0)
  const [newTradeIds, setNewTradeIds] = useState<Set<string>>(new Set())

  // Current market selection (if any) - could be added to store later
  const selectedMarketId = null 

  const { data: apiTrades, isLoading, error } = useQuery<Trade[]>({
    queryKey: ['trades', selectedMarketId],
    queryFn: () => {
      const url = selectedMarketId ? `/api/trades?marketId=${selectedMarketId}` : '/api/trades'
      return fetch(url).then((r) => r.json())
    },
    refetchInterval: 15000,
  })

  const liveTrades = useDashboardStore((s) => s.liveTrades)

  // Merge: live trades first, then API data, deduplicate
  const allTrades = useMemo(() => {
    const seen = new Set<string>()
    const result: Trade[] = []
    for (const t of liveTrades) {
      if (!seen.has(t.id)) {
        seen.add(t.id)
        result.push(t)
      }
    }
    for (const t of (Array.isArray(apiTrades) ? apiTrades : [])) {
      if (!seen.has(t.id)) {
        seen.add(t.id)
        result.push(t)
      }
    }
    return result
  }, [liveTrades, apiTrades])

  // Track new trades for animation
  useEffect(() => {
    if (allTrades.length > prevCountRef.current) {
      const newIds = new Set(
        allTrades
          .slice(0, allTrades.length - prevCountRef.current)
          .map((t) => t.id)
      )
      setNewTradeIds(newIds)
      // Clear animation after 1.5s
      setTimeout(() => setNewTradeIds(new Set()), 1500)
    }
    prevCountRef.current = allTrades.length
  }, [allTrades.length])

  const filteredTrades = useMemo(() => {
    if (agentOnly) return allTrades.filter((t) => t.isAgentTrade)
    return allTrades
  }, [allTrades, agentOnly])

  // P&L Today calculation
  const pnlSummary = useMemo(() => {
    let positive = 0
    let negative = 0
    for (const t of allTrades) {
      if (t.pnl !== null) {
        if (t.pnl >= 0) positive += t.pnl
        else negative += t.pnl
      }
    }
    return { positive, negative }
  }, [allTrades])

  return (
    <Card className="card-accent-cyan border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <Activity className="h-4 w-4 text-[#00ff41]" />
          LIVE TRADES
          <div className="ml-auto flex items-center gap-2">
            {/* P&L Today */}
            <div className="flex items-center gap-2 text-[9px]">
              <span className="text-[#00ff41]">+${pnlSummary.positive.toFixed(0)}</span>
              <span className="text-[#64748b]">/</span>
              <span className="text-[#ef4444]">-${Math.abs(pnlSummary.negative).toFixed(0)}</span>
            </div>
            {/* Sound Toggle */}
            <button
              onClick={() => setMuted(!muted)}
              className="text-[#64748b] transition-colors hover:text-[#94a3b8]"
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            </button>
            {/* Filter Toggle */}
            <button
              onClick={() => setAgentOnly(!agentOnly)}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all ${
                agentOnly
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                  : 'border-[#1e293b] bg-transparent text-[#64748b] hover:text-[#94a3b8]'
              }`}
            >
              <Filter className="h-2.5 w-2.5" />
              {agentOnly ? 'Agent' : 'All'}
            </button>
            {allTrades.length > 0 && (
              <span className="text-xs text-[#64748b]">
                {allTrades.length} trades
              </span>
            )}
          </div>
        </CardTitle>
        {/* Trade Size Sparkline */}
        {allTrades.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[9px] text-[#64748b]">Size trend</span>
            <TradeSizeSparkline trades={allTrades} />
          </div>
        )}
      </CardHeader>
      <CardContent className="px-2">
        <ScrollArea className="h-[350px]">
          {error ? (
            <p className="px-4 text-xs text-red-400">Failed to load trades</p>
          ) : isLoading ? (
            <div className="space-y-2 px-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-[#1e293b]/50" />
              ))}
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {filteredTrades.map((trade) => {
                const isNew = newTradeIds.has(trade.id)
                return (
                  <div
                    key={trade.id}
                    className={`rounded-lg border-l-2 px-3 py-2 transition-colors ${
                      trade.isAgentTrade
                        ? 'border-l-[#00ff41] bg-[#00ff41]/5'
                        : 'border-l-[#334155] bg-[#0a0e17]/50 hover:bg-[#1e293b]/30'
                    } ${isNew ? 'animate-flash animate-slide-in' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            className={`h-4.5 px-1.5 text-[10px] font-bold ${
                              trade.side === 'YES'
                                ? 'badge-yes'
                                : 'badge-no'
                            }`}
                          >
                            {trade.side}
                          </Badge>
                          {trade.isAgentTrade && (
                            <Badge className="h-4 bg-cyan-500/15 px-1.5 text-[10px] text-cyan-400 border-cyan-500/30">
                              <Bot className="mr-0.5 h-2.5 w-2.5" />
                              AGENT
                            </Badge>
                          )}
                          <span className="truncate text-[11px] text-[#cbd5e1]">
                            {trade.market?.title || trade.marketId}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-[#64748b]">
                          <span>
                            Size:{' '}
                            <span className="font-mono text-[#94a3b8]">
                              ${trade.size.toFixed(2)}
                            </span>
                          </span>
                          <span>
                            Price:{' '}
                            <span className="font-mono text-[#94a3b8]">
                              {(trade.price * 100).toFixed(1)}¢
                            </span>
                          </span>
                          {trade.kellySize !== null && trade.isAgentTrade && (
                            <span>
                              Kelly:{' '}
                              <span className="font-mono text-cyan-400">
                                ${trade.kellySize.toFixed(2)}
                              </span>
                            </span>
                          )}
                          {trade.pnl !== null && (
                            <span
                              className={
                                trade.pnl >= 0
                                  ? 'text-[#00ff41]'
                                  : 'text-[#ef4444]'
                              }
                            >
                              P&L:{' '}
                              {trade.pnl >= 0 ? '+' : ''}
                              {trade.pnl.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-[#64748b]">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDistanceToNow(new Date(trade.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                )
              })}
              {filteredTrades.length === 0 && (
                <p className="py-8 text-center text-xs text-[#64748b]">
                  {agentOnly ? 'No agent trades yet' : 'No trades yet'}
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
