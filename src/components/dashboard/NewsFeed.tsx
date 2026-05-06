'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Newspaper, Bot, Clock, RefreshCw, Filter, Zap, Link2 } from 'lucide-react'
import { useDashboardStore, type NewsEvent } from '@/lib/store'
import { formatDistanceToNow } from 'date-fns'

const categoryColors: Record<string, string> = {
  crypto: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  politics: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  economics: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  sports: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  science: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  default: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

function getSentimentColor(sentiment: number): string {
  if (sentiment > 0.3) return '#00ff41'
  if (sentiment < -0.3) return '#ef4444'
  return '#f59e0b'
}

function getSentimentLabel(sentiment: number): string {
  if (sentiment > 0.3) return 'Bullish'
  if (sentiment < -0.3) return 'Bearish'
  return 'Neutral'
}

function SentimentGauge({ sentiment }: { sentiment: number }) {
  // Map sentiment from [-1, 1] to [0, 100] for the fill
  const fillPercent = ((sentiment + 1) / 2) * 100
  const color = getSentimentColor(sentiment)

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-3 w-16 overflow-hidden rounded-full bg-[#1e293b]">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
          style={{ width: `${fillPercent}%`, backgroundColor: color, opacity: 0.6 }}
        />
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#64748b]/50" />
      </div>
      <span className="text-[9px] font-mono" style={{ color }}>
        {(sentiment > 0 ? '+' : '') + sentiment.toFixed(2)}
      </span>
    </div>
  )
}

export function NewsFeed() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const { data: apiNews, isLoading, error, dataUpdatedAt } = useQuery<NewsEvent[]>({
    queryKey: ['news'],
    queryFn: () => fetch('/api/news').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const newsAlerts = useDashboardStore((s) => s.newsAlerts)

  // Merge: live alerts first, then API data, deduplicate by id
  const allNews = useMemo(() => {
    const seen = new Set<string>()
    const result: NewsEvent[] = []
    for (const n of newsAlerts) {
      if (!seen.has(n.id)) {
        seen.add(n.id)
        result.push(n)
      }
    }
    for (const n of apiNews ?? []) {
      if (!seen.has(n.id)) {
        seen.add(n.id)
        result.push(n)
      }
    }
    return result
  }, [newsAlerts, apiNews])

  const categories = useMemo(() => {
    const cats = new Set(allNews.map((n) => n.category))
    return ['all', ...Array.from(cats)]
  }, [allNews])

  const filteredNews = useMemo(() => {
    if (categoryFilter === 'all') return allNews
    return allNews.filter((n) => n.category === categoryFilter)
  }, [allNews, categoryFilter])

  const breakingCount = useMemo(
    () => allNews.filter((n) => n.impactScore > 0.7).length,
    [allNews]
  )

  const lastRefresh = dataUpdatedAt
    ? formatDistanceToNow(dataUpdatedAt, { addSuffix: true })
    : 'never'

  return (
    <Card className="card-accent-amber border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <Newspaper className="h-4 w-4 text-[#f59e0b]" />
          NEWS FEED
          <div className="ml-auto flex items-center gap-2">
            {breakingCount > 0 && (
              <span className="flex items-center gap-1 rounded-full border border-[#ef4444]/30 bg-[#ef4444]/10 px-2 py-0.5 text-[10px] font-bold text-[#ef4444] animate-pulse">
                <Zap className="h-2.5 w-2.5" />
                {breakingCount} breaking
              </span>
            )}
            <span className="flex items-center gap-1 text-[9px] text-[#64748b]">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" style={{ animationDuration: '3s' }} />
              {lastRefresh}
            </span>
            {filteredNews.length > 0 && (
              <span className="text-xs text-[#64748b]">
                {filteredNews.length} items
              </span>
            )}
          </div>
        </CardTitle>
        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full border px-2 py-0.5 text-[9px] font-medium capitalize transition-all ${
                  categoryFilter === cat
                    ? cat === 'all'
                      ? 'border-[#f59e0b]/30 bg-[#f59e0b]/10 text-[#f59e0b]'
                      : categoryColors[cat] || categoryColors.default
                    : 'border-[#1e293b] text-[#64748b] hover:text-[#94a3b8]'
                }`}
              >
                <Filter className="mr-0.5 inline h-2 w-2" />
                {cat}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-2">
        <ScrollArea className="h-[310px]">
          {error ? (
            <p className="px-4 text-xs text-red-400">Failed to load news</p>
          ) : isLoading ? (
            <div className="space-y-2 px-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full bg-[#1e293b]/50" />
              ))}
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {filteredNews.map((item) => {
                const isBreaking = item.impactScore > 0.7
                return (
                  <div
                    key={item.id}
                    className={`rounded-lg px-3 py-2.5 transition-colors hover:bg-[#1e293b]/30 ${
                      isBreaking ? 'bg-[#ef4444]/5 border border-[#ef4444]/15' : 'bg-[#0a0e17]/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            className={`h-4 px-1.5 text-[10px] ${
                              categoryColors[item.category] ||
                              categoryColors.default
                            }`}
                          >
                            {item.category}
                          </Badge>
                          {isBreaking && (
                            <span className="flex items-center gap-0.5 rounded-full border border-[#ef4444]/30 bg-[#ef4444]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#ef4444]">
                              <Zap className="h-2 w-2" />
                              BREAKING
                            </span>
                          )}
                          <span
                            className="text-[10px] font-semibold"
                            style={{ color: getSentimentColor(item.sentiment) }}
                          >
                            {getSentimentLabel(item.sentiment)}
                          </span>
                          {item.processedByAgent && (
                            <Bot className="h-3 w-3 text-[#00ff41]" />
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-snug text-[#cbd5e1]">
                          {item.title}
                        </p>
                        {/* Sentiment Gauge */}
                        <div className="mt-1.5">
                          <SentimentGauge sentiment={item.sentiment} />
                        </div>
                        {item.agentAction && (
                          <p className="mt-0.5 text-[10px] text-[#00ff41]/80">
                            Agent: {item.agentAction}
                          </p>
                        )}
                        {/* Related Market */}
                        {item.relatedMarketIds && (
                          <div className="mt-1 flex items-center gap-1 text-[9px] text-[#64748b]">
                            <Link2 className="h-2.5 w-2.5" />
                            <span>Related market</span>
                          </div>
                        )}
                      </div>
                      <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-[#64748b]">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDistanceToNow(new Date(item.publishedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                )
              })}
              {filteredNews.length === 0 && (
                <p className="py-8 text-center text-xs text-[#64748b]">
                  No news events
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
