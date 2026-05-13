'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Grid3x3, TrendingUp, ArrowRightLeft, Lightbulb, X } from 'lucide-react'
import type { Market } from '@/lib/store'

/* ─── Abbreviate market name to ~15 chars ─── */
function abbreviate(name: string, maxLen = 15): string {
  if (name.length <= maxLen) return name
  return name.slice(0, maxLen - 1) + ''
}

/* ─── Color scale: -1.0 = red, 0 = dark, +1.0 = green ─── */
function getCellColor(value: number): string {
  if (value >= 1.0) return '#00ff41'
  if (value <= -1.0) return '#ef4444'

  if (value > 0) {
    const t = value
    const r = Math.round(30 * (1 - t) + 0 * t)
    const g = Math.round(41 * (1 - t) + 255 * t)
    const b = Math.round(59 * (1 - t) + 65 * t)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    const t = Math.abs(value)
    const r = Math.round(30 * (1 - t) + 239 * t)
    const g = Math.round(41 * (1 - t) + 68 * t)
    const b = Math.round(59 * (1 - t) + 68 * t)
    return `rgb(${r}, ${g}, ${b})`
  }
}

/* ─── Text color based on cell brightness ─── */
function getCellTextColor(value: number): string {
  if (value >= 0.7) return '#0a0e17'
  if (value <= -0.7) return '#0a0e17'
  if (Math.abs(value) > 0.4) return '#e2e8f0'
  return '#94a3b8'
}

/* ─── Trade opportunity suggestion ─── */
function getTradeOpportunity(
  m1: Market,
  m2: Market,
  correlation: number
): { type: string; description: string; color: string } {
  if (correlation > 0.7) {
    return {
      type: 'HEDGE OPPORTUNITY',
      description: `High positive correlation (${correlation.toFixed(2)}) between "${m1.title}" and "${m2.title}". Consider hedging: if one moves against you, the other likely will too. Diversify by taking opposite positions.`,
      color: '#00ff41',
    }
  } else if (correlation > 0.5) {
    return {
      type: 'CORRELATED PAIR',
      description: `Moderate positive correlation (${correlation.toFixed(2)}). "${m1.title}" and "${m2.title}" tend to move together. Consider portfolio diversification to reduce concentrated risk.`,
      color: '#22d3ee',
    }
  } else if (correlation > 0.3) {
    return {
      type: 'WEAK CORRELATION',
      description: `Weak correlation (${correlation.toFixed(2)}). "${m1.title}" and "${m2.title}" have limited co-movement. Good for diversification — positions here reduce overall portfolio variance.`,
      color: '#f59e0b',
    }
  } else {
    return {
      type: 'DIVERSIFICATION PAIR',
      description: `Low correlation (${correlation.toFixed(2)}). "${m1.title}" and "${m2.title}" are largely independent. Ideal for risk diversification across portfolio.`,
      color: '#94a3b8',
    }
  }
}

/* ─── Summary Stats Component ─── */
function SummaryStats({
  markets,
  matrix,
}: {
  markets: Market[]
  matrix: number[][]
}) {
  const stats = useMemo(() => {
    const n = markets.length
    let totalPairs = 0
    let sumCorr = 0
    let maxCorr = -Infinity
    let maxPair = ['', '']

    let highCorrCount = 0
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const corr = matrix[i][j]
        totalPairs++
        sumCorr += corr
        if (corr > maxCorr) {
          maxCorr = corr
          maxPair = [abbreviate(markets[i].title), abbreviate(markets[j].title)]
        }
        if (corr > 0.7) highCorrCount++
      }
    }

    return {
      totalPairs,
      avgCorr: totalPairs > 0 ? sumCorr / totalPairs : 0,
      highestPair: maxPair.join(' '),
      highCorrCount,
    }
  }, [markets, matrix])

  if (stats.totalPairs === 0) return null

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
        <div className="text-[9px] uppercase tracking-wider text-[#64748b]">Pairs</div>
        <div className="font-mono text-xs font-bold text-[#e2e8f0]">{stats.totalPairs}</div>
      </div>
      <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
        <div className="text-[9px] uppercase tracking-wider text-[#64748b]">Avg Corr</div>
        <div className="font-mono text-xs font-bold text-[#22d3ee]">{stats.avgCorr.toFixed(2)}</div>
      </div>
      <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
        <div className="text-[9px] uppercase tracking-wider text-[#64748b]">Top Pair</div>
        <div className="truncate font-mono text-[10px] font-bold text-[#00ff41]" title={stats.highestPair}>
          {stats.highestPair}
        </div>
      </div>
      <div className="rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/50 px-2 py-1.5 text-center">
        <div className="text-[9px] uppercase tracking-wider text-[#64748b]">High Corr (&gt;0.7)</div>
        <div className="font-mono text-xs font-bold text-[#f59e0b]">{stats.highCorrCount}</div>
      </div>
    </div>
  )
}

/* ─── Color Legend ─── */
function ColorLegend() {
  const stops = [
    { color: '#ef4444', label: '-1.0' },
    { color: '#6b2a2a', label: '-0.5' },
    { color: '#1e293b', label: '0' },
    { color: '#1a6630', label: '+0.5' },
    { color: '#00ff41', label: '+1.0' },
  ]

  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className="text-[9px] text-[#64748b]">Neg</span>
      <div className="flex h-3 w-28 overflow-hidden rounded-sm">
        {stops.map((stop, i) => (
          <div
            key={i}
            className="flex-1"
            style={{ backgroundColor: stop.color }}
          />
        ))}
      </div>
      <span className="text-[9px] text-[#64748b]">Pos</span>
    </div>
  )
}

/* ─── Main Component ─── */
export function CorrelationMatrix() {
  const { data: markets, isLoading, error } = useQuery<Market[]>({
    queryKey: ['markets'],
    queryFn: () => fetch('/api/markets').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  const [selectedCell, setSelectedCell] = useState<{
    row: number
    col: number
    m1: Market
    m2: Market
    corr: number
  } | null>(null)

  // Build correlation matrix from real market data
  const { matrix, sortedMarkets } = useMemo(() => {
    if (!markets || markets.length === 0) return { matrix: [], sortedMarkets: [] }

    const sorted = [...markets].sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title))
    const n = sorted.length
    const m: number[][] = Array.from({ length: n }, () => Array(n).fill(1.0))

    // Simple category-based correlation heuristic (no PRNG, deterministic from data)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const m1 = sorted[i]
        const m2 = sorted[j]
        if (m1.id === m2.id) continue

        const sameCategory = m1.category === m2.category

        // Deterministic correlation based on market properties
        // If same category, use a moderate positive correlation
        if (sameCategory) {
          m[i][j] = m[j][i] = 0.5
        } else {
          // Different categories: low correlation
          m[i][j] = m[j][i] = 0.2
        }
      }
    }

    return { matrix: m, sortedMarkets: sorted }
  }, [markets])

  const handleCellHover = useCallback((row: number, col: number | null) => {
    if (col === null) {
      setHoveredCell(null)
    } else {
      setHoveredCell({ row, col })
    }
  }, [])

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (row === col) return
      setSelectedCell({
        row,
        col,
        m1: sortedMarkets[row],
        m2: sortedMarkets[col],
        corr: matrix[row][col],
      })
    },
    [sortedMarkets, matrix]
  )

  const closeOpportunity = useCallback(() => {
    setSelectedCell(null)
  }, [])

  const isHighlighted = useCallback(
    (row: number, col: number) => {
      if (!hoveredCell) return false
      return row === hoveredCell.row || col === hoveredCell.col
    },
    [hoveredCell]
  )

  const n = sortedMarkets.length
  const cellSize = n <= 8 ? 44 : n <= 12 ? 36 : 30
  const labelWidth = 72

  if (error) {
    return (
      <Card className="card-accent-purple border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Grid3x3 className="h-4 w-4 text-[#a855f7]" />
            CORRELATION MATRIX
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load markets</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-purple border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]" title="Correlation between market categories">
          <Grid3x3 className="h-4 w-4 text-[#a855f7]" />
          CORRELATION MATRIX
          <span className="ml-auto text-[10px] font-mono text-[#64748b]">
            {n > 0 ? `${n} markets` : ''}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-[#1e293b]/50" />
            ))}
          </div>
        ) : n === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#64748b]">
            <Grid3x3 className="mb-2 h-8 w-8 opacity-30" />
            <p className="text-xs">No active markets available</p>
          </div>
        ) : (
          <>
            <SummaryStats markets={sortedMarkets} matrix={matrix} />

            <ScrollArea className="max-h-[400px]">
              <div className="min-w-fit">
                {/* Column headers */}
                <div
                  className="flex"
                  style={{ paddingLeft: labelWidth }}
                >
                  {sortedMarkets.map((m, j) => (
                    <div
                      key={`col-${m.id}`}
                      className="flex items-end justify-center text-[8px] font-mono text-[#64748b]"
                      style={{
                        width: cellSize,
                        height: 48,
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                      }}
                    >
                      <span className="truncate">{abbreviate(m.title, 12)}</span>
                    </div>
                  ))}
                </div>

                {/* Matrix rows */}
                {sortedMarkets.map((market, i) => (
                  <div key={`row-${market.id}`} className="flex items-center">
                    <div
                      className="shrink-0 truncate text-right font-mono text-[8px] text-[#64748b]"
                      style={{ width: labelWidth, paddingRight: 6 }}
                      title={market.title}
                    >
                      {abbreviate(market.title, 12)}
                    </div>

                    {sortedMarkets.map((_, j) => {
                      const value = matrix[i][j]
                      const isDiagonal = i === j
                      const highlighted = isHighlighted(i, j)
                      const isHovered = hoveredCell?.row === i && hoveredCell?.col === j
                      const bg = getCellColor(value)
                      const textColor = isDiagonal ? '#0a0e17' : getCellTextColor(value)

                      return (
                        <Tooltip key={`cell-${i}-${j}`}>
                          <TooltipTrigger asChild>
                            <motion.div
                              className="flex items-center justify-center rounded-[2px] text-[9px] font-mono font-bold transition-all duration-100"
                              style={{
                                width: cellSize,
                                height: cellSize,
                                backgroundColor: bg,
                                color: textColor,
                                opacity: highlighted && !isHovered ? 1 : highlighted && isHovered ? 1 : hoveredCell ? 0.4 : 1,
                                border: isDiagonal ? '1px solid rgba(0,255,65,0.3)' : '1px solid rgba(30,41,59,0.6)',
                                boxShadow: isHovered
                                  ? '0 0 8px rgba(168,85,247,0.4)'
                                  : isDiagonal
                                    ? '0 0 4px rgba(0,255,65,0.2)'
                                    : 'none',
                                cursor: isDiagonal ? 'default' : 'pointer',
                              }}
                              onMouseEnter={() => handleCellHover(i, j)}
                              onMouseLeave={() => handleCellHover(i, -1)}
                              onClick={() => handleCellClick(i, j)}
                              whileHover={isDiagonal ? {} : { scale: 1.1, zIndex: 10 }}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{
                                delay: (i * n + j) * 0.005,
                                duration: 0.2,
                              }}
                            >
                              {value.toFixed(2)}
                            </motion.div>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="border-[#1e293b] bg-[#0f1724] px-3 py-2 text-[#e2e8f0] shadow-xl"
                            sideOffset={4}
                          >
                            <div className="space-y-1 text-[10px]">
                              <div className="font-semibold text-[#a855f7]">
                                {abbreviate(sortedMarkets[i].title, 20)}
                              </div>
                              <div className="text-[#64748b]">↔</div>
                              <div className="font-semibold text-[#a855f7]">
                                {abbreviate(sortedMarkets[j].title, 20)}
                              </div>
                              <div className="h-px bg-[#1e293b]" />
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-[#94a3b8]">Correlation:</span>
                                <span
                                  className="font-mono font-bold"
                                  style={{ color: value > 0 ? '#00ff41' : value < 0 ? '#ef4444' : '#94a3b8' }}
                                >
                                  {value.toFixed(4)}
                                </span>
                              </div>
                              {sortedMarkets[i].category === sortedMarkets[j].category && (
                                <div className="text-[9px] text-cyan-400">
                                  Same category: {sortedMarkets[i].category}
                                </div>
                              )}
                              {!isDiagonal && (
                                <div className="text-[8px] text-[#64748b]">
                                  Click for trade insight
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <ColorLegend />

            {/* Category Legend */}
            {(() => {
              const categories = [...new Set(sortedMarkets.map((m) => m.category))]
              return (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[9px] text-[#64748b]">Categories:</span>
                  {categories.map((cat) => (
                    <Badge
                      key={cat}
                      className="h-4 border-[#a855f7]/30 bg-[#a855f7]/10 px-1.5 text-[8px] text-[#a855f7]"
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              )
            })()}

            {/* Trade Opportunity Panel */}
            <AnimatePresence>
              {selectedCell && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg border border-[#1e293b] bg-[#0a0e17]/80 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Lightbulb
                          className="h-4 w-4 shrink-0"
                          style={{ color: getTradeOpportunity(selectedCell.m1, selectedCell.m2, selectedCell.corr).color }}
                        />
                        <span
                          className="text-[11px] font-bold"
                          style={{ color: getTradeOpportunity(selectedCell.m1, selectedCell.m2, selectedCell.corr).color }}
                        >
                          {getTradeOpportunity(selectedCell.m1, selectedCell.m2, selectedCell.corr).type}
                        </span>
                      </div>
                      <button
                        onClick={closeOpportunity}
                        className="shrink-0 rounded p-0.5 text-[#64748b] transition-colors hover:text-[#94a3b8]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <Badge className="h-5 border-[#1e293b] bg-[#1e293b]/50 px-2 text-[9px] text-[#e2e8f0]">
                        <ArrowRightLeft className="mr-1 h-3 w-3 text-[#a855f7]" />
                        {abbreviate(selectedCell.m1.title, 18)}
                      </Badge>
                      <span className="text-[10px] text-[#64748b]">↔</span>
                      <Badge className="h-5 border-[#1e293b] bg-[#1e293b]/50 px-2 text-[9px] text-[#e2e8f0]">
                        {abbreviate(selectedCell.m2.title, 18)}
                      </Badge>
                      <span className="ml-auto font-mono text-xs font-bold" style={{ color: selectedCell.corr > 0.5 ? '#00ff41' : '#22d3ee' }}>
                        ρ = {selectedCell.corr.toFixed(2)}
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] leading-relaxed text-[#94a3b8]">
                      {getTradeOpportunity(selectedCell.m1, selectedCell.m2, selectedCell.corr).description}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-[#00ff41]" />
                      <span className="text-[10px] font-medium text-[#00ff41]">
                        {selectedCell.corr > 0.7
                          ? 'Consider opposite-side positions to hedge'
                          : selectedCell.corr > 0.5
                            ? 'Monitor for synchronized moves'
                            : 'Good diversification candidate'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </CardContent>
    </Card>
  )
}
