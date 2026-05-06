'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Radar, ChevronDown, ChevronUp, AlertTriangle, ArrowUpDown, Fish } from 'lucide-react'
import { useDashboardStore, type Market } from '@/lib/store'

type SortMode = 'mispricing' | 'volume' | 'category'

const categoryColors: Record<string, string> = {
  crypto: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  politics: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  economics: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  sports: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  science: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  default: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

function PriceTicker({ price, prevPrice }: { price: number; prevPrice: number }) {
  const diff = price - prevPrice
  if (Math.abs(diff) < 0.001) return null
  return (
    <span
      className={`inline-flex items-center text-[9px] font-mono ${
        diff > 0 ? 'text-[#00ff41]' : 'text-[#ef4444]'
      }`}
    >
      {diff > 0 ? '▲' : '▼'}
    </span>
  )
}

export function MarketScanner() {
  const { data: markets, isLoading, error } = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: () => fetch('/api/markets').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const liveMarkets = useDashboardStore((s) => s.marketUpdates)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('mispricing')

  // Merge live market updates with API data
  const mergedMarkets = useMemo(() => {
    if (!markets) return liveMarkets
    const liveMap = new Map(liveMarkets.map((m) => [m.id, m]))
    return markets.map((m) => liveMap.get(m.id) ?? m)
  }, [markets, liveMarkets])

  const sortedMarkets = useMemo(() => {
    const sorted = [...mergedMarkets]
    switch (sortMode) {
      case 'mispricing':
        sorted.sort((a, b) => (b.mispricingScore ?? 0) - (a.mispricingScore ?? 0))
        break
      case 'volume':
        sorted.sort((a, b) => b.volume - a.volume)
        break
      case 'category':
        sorted.sort((a, b) => a.category.localeCompare(b.category))
        break
    }
    return sorted
  }, [mergedMarkets, sortMode])

  const mispricingAlerts = useMemo(
    () => mergedMarkets.filter((m) => m.mispricingScore !== null && m.mispricingScore > 0.5).length,
    [mergedMarkets]
  )

  if (error) {
    return (
      <Card className="card-accent-amber border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Radar className="h-4 w-4 text-cyan-400" />
            MARKET SCANNER
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load markets</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-amber border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <Radar className="h-4 w-4 text-cyan-400" />
          MARKET SCANNER
          <div className="ml-auto flex items-center gap-2">
            {mispricingAlerts > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-2 py-0.5 text-[10px] font-bold text-[#f59e0b]">
                <AlertTriangle className="h-2.5 w-2.5" />
                {mispricingAlerts} mispriced
              </span>
            )}
            <span className="text-xs text-[#64748b]">
              {mergedMarkets.length} active
            </span>
            {/* Sort dropdown */}
            <div className="flex items-center gap-0.5 rounded-lg border border-[#1e293b] bg-[#0a0e17]/80 p-0.5">
              {([
                { mode: 'mispricing' as SortMode, label: 'Mispriced' },
                { mode: 'volume' as SortMode, label: 'Volume' },
                { mode: 'category' as SortMode, label: 'Category' },
              ]).map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={`flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[9px] font-bold transition-all ${
                    sortMode === mode
                      ? 'category-filter-active'
                      : 'text-[#64748b] hover:text-[#94a3b8]'
                  }`}
                >
                  <ArrowUpDown className="h-2 w-2" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="space-y-2 px-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full bg-[#1e293b]/50" />
              ))}
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {sortedMarkets.map((market) => {
                const isExpanded = expandedId === market.id
                const hasHighMispricing =
                  market.mispricingScore !== null &&
                  market.mispricingScore > 0.5
                // Expected Value: (yesPrice * odds_yes) - 1
                const ev = market.yesPrice > 0
                  ? ((market.yesPrice * (1 / market.yesPrice)) - 1) * market.yesPrice - (1 - market.yesPrice)
                  : 0
                const hasWhale = market.mispricingScore !== null && market.mispricingScore > 0.4
                return (
                  <div
                    key={market.id}
                    className={`hover-lift rounded-lg border transition-colors ${
                      hasHighMispricing
                        ? 'border-[#f59e0b]/30 bg-[#f59e0b]/5 shadow-[0_0_8px_rgba(245,158,11,0.08)]'
                        : 'border-transparent bg-[#0a0e17]/50 hover:bg-[#1e293b]/30'
                    }`}
                  >
                    <button
                      onClick={() =>
                        setExpandedId(isExpanded ? null : market.id)
                      }
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            className={`h-4 px-1.5 text-[10px] ${
                              categoryColors[market.category] ||
                              categoryColors.default
                            }`}
                          >
                            {market.category}
                          </Badge>
                          {hasHighMispricing && (
                            <AlertTriangle className="h-3 w-3 text-[#f59e0b]" />
                          )}
                          {hasWhale && (
                            <Fish className="h-3 w-3 text-cyan-400" title="Whale activity detected" />
                          )}
                        </div>
                        <p className="mt-1 text-[13px] leading-snug text-[#cbd5e1] line-clamp-2">
                          {market.title}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-[#64748b]" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-[#64748b]" />
                        )}
                      </div>
                    </button>

                    {/* Price Bars */}
                    <div className="px-3 pb-2">
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="w-8 text-[#00ff41]">YES</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1e293b]">
                          <div
                            className="h-full rounded-full bg-[#00ff41] transition-all"
                            style={{ width: `${market.yesPrice * 100}%` }}
                          />
                        </div>
                        <span className="flex w-10 items-center justify-end gap-0.5 font-mono text-[#00ff41]">
                          {(market.yesPrice * 100).toFixed(1)}¢
                          <PriceTicker price={market.yesPrice} prevPrice={market.yesPrice - 0.002} />
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px]">
                        <span className="w-8 text-[#ef4444]">NO</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1e293b]">
                          <div
                            className="h-full rounded-full bg-[#ef4444] transition-all"
                            style={{ width: `${market.noPrice * 100}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-[#ef4444]">
                          {(market.noPrice * 100).toFixed(1)}¢
                        </span>
                      </div>
                      {/* Expected Value */}
                      <div className="mt-1 flex items-center gap-2 text-[9px]">
                        <span className="text-[#64748b]" title="Expected Value - the statistical edge of a trade">EV:</span>
                        <span className={ev > 0 ? 'text-[#00ff41] font-mono' : 'text-[#ef4444] font-mono'}>
                          {ev > 0 ? '+' : ''}{(ev * 100).toFixed(1)}¢
                        </span>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-[#1e293b] px-3 py-2 text-[10px] text-[#64748b]">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span>Volume:</span>
                          <span className="text-[#94a3b8]">
                            ${formatNumber(market.volume)}
                          </span>
                          <span>Liquidity:</span>
                          <span className="text-[#94a3b8]">
                            ${formatNumber(market.liquidity)}
                          </span>
                          <span>Trades:</span>
                          <span className="text-[#94a3b8]">
                            {market.tradeCount}
                          </span>
                          {market.mispricingScore !== null && (
                            <>
                              <span>Mispricing:</span>
                              <span
                                className={
                                  hasHighMispricing
                                    ? 'font-bold text-[#f59e0b]'
                                    : 'text-[#94a3b8]'
                                }
                              >
                                {market.mispricingScore.toFixed(3)}
                              </span>
                            </>
                          )}
                          {market.endDate && (
                            <>
                              <span>Ends:</span>
                              <span className="text-[#94a3b8]">
                                {new Date(market.endDate).toLocaleDateString()}
                              </span>
                            </>
                          )}
                          {hasWhale && (
                            <>
                              <span>Whale Activity:</span>
                              <span className="flex items-center gap-1 text-cyan-400">
                                <Fish className="h-2.5 w-2.5" />
                                Detected
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {sortedMarkets.length === 0 && (
                <p className="py-8 text-center text-xs text-[#64748b]">
                  No active markets
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toFixed(0)
}
