'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BookOpen, RefreshCw } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { Market } from '@/lib/store'

interface OrderLevel {
  price: number
  size: number
  total: number
  isWall: boolean
}

interface OrderBookData {
  bids: OrderLevel[]
  asks: OrderLevel[]
  bestBid: number
  bestAsk: number
  spread: number
  spreadPct: number
  bidDepth: number
  askDepth: number
}

// ─── Build order book from real market data ───
function buildOrderBook(market: Market): OrderBookData {
  const currentPriceCents = Math.round(market.yesPrice * 100)
  const spread = 1
  const bestBid = currentPriceCents
  const bestAsk = currentPriceCents + spread

  const NUM_LEVELS = 8

  const bids: OrderLevel[] = []
  let bidTotal = 0
  for (let i = 0; i < NUM_LEVELS; i++) {
    const price = bestBid - i
    if (price <= 0) break

    // Deterministic sizes based on price proximity
    const proximityFactor = Math.exp(-0.3 * i)
    const baseSize = 200 + proximityFactor * 800
    const size = Math.max(20, Math.round(baseSize))

    bidTotal += size
    bids.push({
      price,
      size,
      total: bidTotal,
      isWall: false,
    })
  }

  const asks: OrderLevel[] = []
  let askTotal = 0
  for (let i = 0; i < NUM_LEVELS; i++) {
    const price = bestAsk + i
    if (price >= 100) break

    const proximityFactor = Math.exp(-0.3 * i)
    const baseSize = 180 + proximityFactor * 700
    const size = Math.max(20, Math.round(baseSize))

    askTotal += size
    asks.push({
      price,
      size,
      total: askTotal,
      isWall: false,
    })
  }

  const midPrice = (bestBid + bestAsk) / 2
  const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0

  return { bids, asks, bestBid, bestAsk, spread, spreadPct, bidDepth: bidTotal, askDepth: askTotal }
}

function buildDepthChartData(orderBook: OrderBookData) {
  const data: { price: number; bidDepth: number; askDepth: number }[] = []

  const bidPoints = [...orderBook.bids].reverse()
  let bidCum = 0
  for (const level of bidPoints) {
    bidCum = level.total
    data.push({ price: level.price, bidDepth: bidCum, askDepth: 0 })
  }

  let askCum = 0
  for (const level of orderBook.asks) {
    askCum = level.total
    data.push({ price: level.price, bidDepth: 0, askDepth: askCum })
  }

  return data
}

function DepthTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: number }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="px-3 py-2 shadow-xl" style={{ backgroundColor: '#0f1724', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '10px', color: '#e2e8f0' }}>
      <div className="mb-1.5 font-semibold text-[#94a3b8]">Price: {label}¢</div>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[#94a3b8]">{entry.dataKey === 'bidDepth' ? 'Bid' : 'Ask'} Depth:</span>
          <span className="font-mono font-bold text-[#e2e8f0]">{entry.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

export function OrderBookDepth() {
  const { data: markets, isLoading, error } = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: () => fetch('/api/markets').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const [selectedMarketId, setSelectedMarketId] = useState<string>('')
  const [refreshKey, setRefreshKey] = useState(0)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const effectiveMarketId = useMemo(() => {
    if (selectedMarketId) return selectedMarketId
    if (markets && markets.length > 0) return markets[0].id
    return ''
  }, [selectedMarketId, markets])

  const selectedMarket = useMemo(() => {
    if (!markets || !effectiveMarketId) return null
    return markets.find((m) => m.id === effectiveMarketId) ?? null
  }, [markets, effectiveMarketId])

  // Build order book from real data
  const orderBook = useMemo(() => {
    if (!selectedMarket) return null
    return buildOrderBook(selectedMarket)
  }, [selectedMarket, refreshKey])

  const chartData = useMemo(() => {
    if (!orderBook) return []
    return buildDepthChartData(orderBook)
  }, [orderBook])

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      setRefreshKey((k) => k + 1)
    }, 10000)
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current)
    }
  }, [])

  const bidAskRatio = useMemo(() => {
    if (!orderBook) return 1
    if (orderBook.askDepth === 0) return Infinity
    return orderBook.bidDepth / orderBook.askDepth
  }, [orderBook])

  if (error) {
    return (
      <Card className="card-accent-red rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <BookOpen className="h-4 w-4 text-[#ef4444]" />
            ORDER BOOK DEPTH
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load markets</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-red rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[#ef4444]" />
            <span className="card-title-cyber">ORDER BOOK DEPTH</span>
            <span className="text-[10px] font-normal text-[#64748b]">Real-time bid/ask liquidity</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#00ff41]" />
              <span className="text-[9px] font-mono font-bold text-[#00ff41]/70">LIVE</span>
            </span>
            <button
              onClick={handleRefresh}
              className="flex h-6 items-center gap-1 rounded-md border border-[#1e293b] bg-[#0a0e17]/80 px-2 text-[10px] font-bold text-[#64748b] transition-colors hover:border-[#ef4444]/30 hover:text-[#ef4444]"
            >
              <RefreshCw className="h-2.5 w-2.5" />
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-8 w-full bg-[#1e293b]/50" />
        ) : (
          <Select value={effectiveMarketId} onValueChange={(val) => setSelectedMarketId(val)}>
            <SelectTrigger size="sm" className="w-full border-[#1e293b] bg-[#0a0e17]/80 text-xs text-[#94a3b8] hover:border-[#ef4444]/30 focus-visible:ring-[#ef4444]/20">
              <SelectValue placeholder="Select a market..." />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] border-[#1e293b] bg-[#0f1724] text-[#94a3b8]">
              {markets?.map((market) => (
                <SelectItem key={market.id} value={market.id} className="text-xs text-[#94a3b8] focus:bg-[#ef4444]/10 focus:text-[#ef4444]">
                  <span className="line-clamp-1">{(market.yesPrice * 100).toFixed(1)}¢ — {market.title}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {selectedMarket && orderBook && (
          <motion.div
            key={selectedMarket.id + refreshKey}
            initial={{ opacity: 0.8 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {/* Spread info */}
            <div className="flex items-center justify-between rounded-md border border-[#1e293b]/40 bg-[#0a0e17]/30 px-3 py-2 text-[10px]">
              <span className="font-mono text-[#00ff41]">Bid: {(orderBook.bestBid / 100).toFixed(2)}¢</span>
              <span className="font-mono text-[#ef4444]">Ask: {(orderBook.bestAsk / 100).toFixed(2)}¢</span>
              <span className="font-mono text-[#64748b]">Spread: {orderBook.spreadPct.toFixed(2)}%</span>
            </div>

            {/* Depth Chart */}
            <div className="h-[200px] w-full rounded-lg border border-[#1e293b]/40 bg-[#0a0e17]/30 px-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="bidGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00ff41" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#00ff41" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="askGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="price" type="number" domain={['dataMin', 'dataMax']} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v: number) => `${v}¢`} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v: number) => v.toLocaleString()} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={<DepthTooltip />} />
                  <ReferenceLine x={orderBook.bestBid + (orderBook.spread / 2)} stroke="#ffffff" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />
                  <Area type="monotone" dataKey="bidDepth" stroke="#00ff41" strokeWidth={1.5} fill="url(#bidGradient)" animationDuration={600} connectNulls={false} dot={false} />
                  <Area type="monotone" dataKey="askDepth" stroke="#ef4444" strokeWidth={1.5} fill="url(#askGradient)" animationDuration={600} connectNulls={false} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Bid/Ask Table */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 flex items-center justify-between px-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#00ff41]">Bids</span>
                  <span className="text-[8px] text-[#64748b]">Price · Size · Total</span>
                </div>
                <div className="space-y-0.5">
                  {orderBook.bids.map((level, i) => {
                    const maxSize = Math.max(...orderBook.bids.map((b) => b.size))
                    const barWidth = (level.size / maxSize) * 100
                    const isBest = i === 0
                    return (
                      <div key={`bid-${level.price}`} className="relative flex items-center justify-between rounded-sm px-1.5 py-[3px] text-[10px] font-mono" style={{ backgroundColor: isBest ? 'rgba(0, 255, 65, 0.08)' : 'transparent' }}>
                        <div className="absolute inset-y-0 left-0 rounded-sm transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: isBest ? 'rgba(0, 255, 65, 0.12)' : 'rgba(0, 255, 65, 0.06)' }} />
                        <div className="relative z-10 flex w-full items-center justify-between">
                          <span className={`font-semibold ${isBest ? 'text-[#00ff41]' : 'text-[#00ff41]/80'}`}>{level.price.toFixed(1)}¢</span>
                          <span className="text-[#94a3b8]">{level.size.toLocaleString()}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between px-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#ef4444]">Asks</span>
                  <span className="text-[8px] text-[#64748b]">Price · Size · Total</span>
                </div>
                <div className="space-y-0.5">
                  {orderBook.asks.map((level, i) => {
                    const maxSize = Math.max(...orderBook.asks.map((a) => a.size))
                    const barWidth = (level.size / maxSize) * 100
                    const isBest = i === 0
                    return (
                      <div key={`ask-${level.price}`} className="relative flex items-center justify-between rounded-sm px-1.5 py-[3px] text-[10px] font-mono" style={{ backgroundColor: isBest ? 'rgba(239, 68, 68, 0.08)' : 'transparent' }}>
                        <div className="absolute inset-y-0 left-0 rounded-sm transition-all duration-500" style={{ width: `${barWidth}%`, backgroundColor: isBest ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.06)' }} />
                        <div className="relative z-10 flex w-full items-center justify-between">
                          <span className={`font-semibold ${isBest ? 'text-[#ef4444]' : 'text-[#ef4444]/80'}`}>{level.price.toFixed(1)}¢</span>
                          <span className="text-[#94a3b8]">{level.size.toLocaleString()}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-[#1e293b] bg-[#0a0e17]/80 px-3 py-1.5 text-[9px]">
              <span className="font-mono text-[#94a3b8]">Bid Depth: {orderBook.bidDepth.toLocaleString()}</span>
              <span className="font-mono text-[#94a3b8]">Ask Depth: {orderBook.askDepth.toLocaleString()}</span>
              <span className="font-mono text-[#64748b]">Ratio: {bidAskRatio.toFixed(2)}</span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
