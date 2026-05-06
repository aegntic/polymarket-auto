'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BarChart3, RefreshCw } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import type { Market } from '@/lib/store'

// --- Depth Data Generation ---

interface DepthLevel {
  price: string // e.g. "52¢"
  priceRaw: number // numeric for calculations
  yesVolume: number
  noVolume: number
}

function gaussianRandom(): number {
  // Box-Muller transform for approximate normal distribution
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function generateDepthData(yesPrice: number, noPrice: number): DepthLevel[] {
  const levels: DepthLevel[] = []
  const numLevels = 10
  const priceStep = 5 // 5¢ steps
  const centerYes = Math.round(yesPrice * 100)
  const centerNo = Math.round(noPrice * 100)
  const halfSpan = Math.floor(numLevels / 2) * priceStep

  for (let i = 0; i < numLevels; i++) {
    const offset = (i - Math.floor(numLevels / 2)) * priceStep
    const priceYes = Math.max(1, Math.min(99, centerYes + offset))
    const priceNo = Math.max(1, Math.min(99, centerNo + offset))

    // Bell curve: peak at center, taper off at edges
    const distFromCenter = Math.abs(offset) / halfSpan
    const bellFactor = Math.exp(-2 * distFromCenter * distFromCenter)

    // YES depth: volume peaks near current yesPrice
    const yesBase = 500 + bellFactor * 4500
    const yesNoise = gaussianRandom() * 600
    const yesVolume = Math.max(50, Math.round(yesBase + yesNoise))

    // NO depth: volume peaks near current noPrice
    const noBase = 400 + bellFactor * 3800
    const noNoise = gaussianRandom() * 500
    const noVolume = Math.max(50, Math.round(noBase + noNoise))

    // Use a unified price label based on the YES price levels
    levels.push({
      price: `${priceYes}¢`,
      priceRaw: priceYes,
      yesVolume,
      noVolume,
    })
  }

  return levels
}

// --- Custom Tooltip ---

function DepthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      className="px-3 py-2 shadow-xl"
      style={{
        backgroundColor: '#0f1724',
        border: '1px solid #1e293b',
        borderRadius: '6px',
        fontSize: '10px',
        color: '#e2e8f0',
      }}
    >
      <div className="mb-1.5 font-semibold text-[#94a3b8]">Price: {label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[#94a3b8]">
            {entry.dataKey === 'yesVolume' ? 'YES' : 'NO'} Depth:
          </span>
          <span className="font-mono font-bold text-[#e2e8f0]">
            ${entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

// --- Main Component ---

export function MarketDepth() {
  const { data: markets, isLoading, error } = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: () => fetch('/api/markets').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const [selectedMarketId, setSelectedMarketId] = useState<string>('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Auto-select first market when data loads
  const effectiveMarketId = useMemo(() => {
    if (selectedMarketId) return selectedMarketId
    if (markets && markets.length > 0) return markets[0].id
    return ''
  }, [selectedMarketId, markets])

  const selectedMarket = useMemo(() => {
    if (!markets || !effectiveMarketId) return null
    return markets.find((m) => m.id === effectiveMarketId) ?? null
  }, [markets, effectiveMarketId])

  // Generate depth data (re-computed on market change or refresh)
  const depthData = useMemo(() => {
    if (!selectedMarket) return []
    return generateDepthData(selectedMarket.yesPrice, selectedMarket.noPrice)
    // refreshKey triggers regeneration without changing market
  }, [selectedMarket, refreshKey])

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  // Computed stats
  const stats = useMemo(() => {
    if (!selectedMarket || depthData.length === 0) return null

    const totalYesVolume = depthData.reduce((sum, d) => sum + d.yesVolume, 0)
    const totalNoVolume = depthData.reduce((sum, d) => sum + d.noVolume, 0)
    const totalVolume = totalYesVolume + totalNoVolume

    // Spread: difference between best ask and best bid (in cents)
    const spread = Math.abs(
      selectedMarket.yesPrice * 100 - selectedMarket.noPrice * 100
    )
    // Mid price: average of yes and no
    const midPrice = ((selectedMarket.yesPrice + selectedMarket.noPrice) / 2) * 100

    return {
      spread: spread.toFixed(1),
      midPrice: midPrice.toFixed(1),
      totalVolume: totalVolume.toLocaleString(),
      totalYesVolume: totalYesVolume.toLocaleString(),
      totalNoVolume: totalNoVolume.toLocaleString(),
    }
  }, [selectedMarket, depthData])

  // --- Render ---

  if (error) {
    return (
      <Card className="card-accent-cyan border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            MARKET DEPTH
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load markets</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-cyan border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            MARKET DEPTH
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-7 gap-1.5 rounded-md border border-[#1e293b] bg-[#0a0e17]/80 px-2.5 text-[10px] font-bold text-[#64748b] hover:border-cyan-500/30 hover:text-cyan-400"
            >
              <RefreshCw className="h-3 w-3" />
              REFRESH
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Market Selector */}
        {isLoading ? (
          <Skeleton className="h-8 w-full bg-[#1e293b]/50" />
        ) : (
          <Select
            value={effectiveMarketId}
            onValueChange={(val) => setSelectedMarketId(val)}
          >
            <SelectTrigger
              size="sm"
              className="w-full border-[#1e293b] bg-[#0a0e17]/80 text-xs text-[#94a3b8] hover:border-cyan-500/30 focus-visible:ring-cyan-500/20"
            >
              <SelectValue placeholder="Select a market..." />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] border-[#1e293b] bg-[#0f1724] text-[#94a3b8]">
              {markets?.map((market) => (
                <SelectItem
                  key={market.id}
                  value={market.id}
                  className="text-xs text-[#94a3b8] focus:bg-cyan-500/10 focus:text-cyan-400"
                >
                  <span className="line-clamp-1">
                    {(market.yesPrice * 100).toFixed(1)}¢ YES — {market.title}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Selected Market Info */}
        {selectedMarket && (
          <motion.div
            key={selectedMarket.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {/* Price Summary Row */}
            <div className="flex items-center justify-between rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-3 py-2">
              <div className="flex items-center gap-4 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[#64748b]">YES</span>
                  <span className="font-mono font-bold text-[#00ff41]">
                    {(selectedMarket.yesPrice * 100).toFixed(1)}¢
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[#64748b]">NO</span>
                  <span className="font-mono font-bold text-[#ef4444]">
                    {(selectedMarket.noPrice * 100).toFixed(1)}¢
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="text-[#64748b]">Spread:</span>
                  <span className="font-mono font-bold text-[#f59e0b]">
                    {stats?.spread}¢
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[#64748b]">Mid:</span>
                  <span className="font-mono font-bold text-[#e2e8f0]">
                    {stats?.midPrice}¢
                  </span>
                </div>
              </div>
            </div>

            {/* Depth Chart */}
            <AnimatePresence mode="wait">
              <motion.div
                key={refreshKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="h-[260px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={depthData}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    barCategoryGap="20%"
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 9, fill: '#64748b' }}
                      tickFormatter={(v: number) => `$${v}`}
                      axisLine={{ stroke: '#1e293b' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="price"
                      tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'monospace' }}
                      axisLine={{ stroke: '#1e293b' }}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      content={<DepthTooltip />}
                      cursor={{ fill: 'rgba(30, 41, 59, 0.4)' }}
                    />
                    {/* Mid price reference line */}
                    <ReferenceLine
                      x={
                        stats
                          ? (parseInt(stats.totalYesVolume.replace(/,/g, '')) +
                              parseInt(stats.totalNoVolume.replace(/,/g, ''))) /
                            depthData.length /
                            2
                          : 0
                      }
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                    <Bar
                      dataKey="yesVolume"
                      name="YES Depth"
                      radius={[0, 3, 3, 0]}
                      animationDuration={600}
                    >
                      {depthData.map((entry, index) => (
                        <Cell
                          key={`yes-${index}`}
                          fill="#00ff41"
                          fillOpacity={
                            0.4 +
                            0.6 *
                              Math.exp(
                                -2 *
                                  Math.pow(
                                    (entry.priceRaw -
                                      Math.round(
                                        selectedMarket.yesPrice * 100
                                      )) /
                                      25,
                                    2
                                  )
                              )
                          }
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="noVolume"
                      name="NO Depth"
                      radius={[0, 3, 3, 0]}
                      animationDuration={600}
                    >
                      {depthData.map((entry, index) => (
                        <Cell
                          key={`no-${index}`}
                          fill="#ef4444"
                          fillOpacity={
                            0.4 +
                            0.6 *
                              Math.exp(
                                -2 *
                                  Math.pow(
                                    (entry.priceRaw -
                                      Math.round(
                                        selectedMarket.noPrice * 100
                                      )) /
                                      25,
                                    2
                                  )
                              )
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </AnimatePresence>

            {/* Volume Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
                  YES Vol
                </div>
                <div className="font-mono text-xs font-bold text-[#00ff41]">
                  ${stats?.totalYesVolume}
                </div>
              </div>
              <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
                  NO Vol
                </div>
                <div className="font-mono text-xs font-bold text-[#ef4444]">
                  ${stats?.totalNoVolume}
                </div>
              </div>
              <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-wider text-[#64748b]">
                  Total Vol
                </div>
                <div className="font-mono text-xs font-bold text-[#e2e8f0]">
                  ${stats?.totalVolume}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-5 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#00ff41]" />
                <span className="text-[#94a3b8]">YES Depth</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#ef4444]" />
                <span className="text-[#94a3b8]">NO Depth</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!isLoading && !selectedMarket && markets && markets.length === 0 && (
          <p className="py-8 text-center text-xs text-[#64748b]">
            No active markets available
          </p>
        )}
      </CardContent>
    </Card>
  )
}
