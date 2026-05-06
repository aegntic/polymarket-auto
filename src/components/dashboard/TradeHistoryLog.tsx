'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollText, Search, ArrowUpDown, ArrowUp, ArrowDown, Bot, Brain, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDashboardStore, type Trade } from '@/lib/store'

// ─── Types ───────────────────────────────────────────────
type SideFilter = 'ALL' | 'BUY' | 'SELL'
type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED' | 'CANCELLED'
type DateRange = '24h' | '7D' | '30D' | 'ALL'
type SortColumn = 'time' | 'market' | 'side' | 'size' | 'price' | 'pnl' | 'status' | 'agent'
type SortDirection = 'asc' | 'desc'

// ─── Helpers ─────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffS = Math.floor(diffMs / 1000)
  if (diffS < 60) return `${diffS}s ago`
  const diffM = Math.floor(diffS / 60)
  if (diffM < 60) return `${diffM}m ago`
  const diffH = Math.floor(diffM / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `${diffD}d ago`
  const diffMo = Math.floor(diffD / 30)
  return `${diffMo}mo ago`
}

function truncateTitle(title: string, maxLen = 30): string {
  if (title.length <= maxLen) return title
  return title.slice(0, maxLen - 1) + '…'
}

function formatSize(size: number): string {
  return '$' + size.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPrice(price: number): string {
  return '$' + price.toFixed(4)
}

function formatPnl(pnl: number | null): string {
  if (pnl === null) return '—'
  const prefix = pnl >= 0 ? '+' : ''
  return prefix + '$' + Math.abs(pnl).toFixed(2)
}

function pnlColor(pnl: number | null): string {
  if (pnl === null) return 'text-[#64748b]'
  return pnl >= 0 ? 'text-[#00ff41]' : 'text-[#ef4444]'
}

function statusBadgeColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'OPEN': return 'bg-[#22d3ee]/10 text-[#22d3ee] border-[#22d3ee]/25'
    case 'CLOSED': return 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/25'
    case 'CANCELLED': return 'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/25'
    default: return 'bg-[#1e293b]/50 text-[#64748b] border-[#1e293b]'
  }
}

// ─── Filter Pill ─────────────────────────────────────────
function FilterPill<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all ${
            value === opt
              ? 'bg-[#00ff41]/12 text-[#00ff41] border border-[#00ff41]/25'
              : 'bg-transparent text-[#64748b] border border-transparent hover:text-[#94a3b8] hover:bg-[#1e293b]/30'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ─── Component ───────────────────────────────────────────
export function TradeHistoryLog() {
  // Filters
  const [search, setSearch] = useState('')
  const [sideFilter, setSideFilter] = useState<SideFilter>('ALL')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [agentOnly, setAgentOnly] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('ALL')

  // Sort
  const [sortColumn, setSortColumn] = useState<SortColumn>('time')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Data
  const { data: apiTrades, isLoading, error } = useQuery<Trade[]>({
    queryKey: ['trades'],
    queryFn: () => fetch('/api/trades').then((r) => r.json()),
    refetchInterval: 15000,
  })

  const liveTrades = useDashboardStore((s) => s.liveTrades)

  // Merge and deduplicate
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

  // Filter
  const filtered = useMemo(() => {
    let result = allTrades

    // Date range
    if (dateRange !== 'ALL') {
      const now = Date.now()
      const cutoff =
        dateRange === '24h' ? now - 24 * 60 * 60 * 1000 :
        dateRange === '7D' ? now - 7 * 24 * 60 * 60 * 1000 :
        now - 30 * 24 * 60 * 60 * 1000
      result = result.filter((t) => new Date(t.createdAt).getTime() >= cutoff)
    }

    // Side filter
    if (sideFilter !== 'ALL') {
      result = result.filter((t) => t.side.toUpperCase() === sideFilter)
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter((t) => t.status.toUpperCase() === statusFilter)
    }

    // Agent only
    if (agentOnly) {
      result = result.filter((t) => t.isAgentTrade)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter((t) => {
        const marketTitle = t.market?.title?.toLowerCase() ?? ''
        const walletAddr = t.wallet?.address?.toLowerCase() ?? ''
        return marketTitle.includes(q) || walletAddr.includes(q)
      })
    }

    return result
  }, [allTrades, dateRange, sideFilter, statusFilter, agentOnly, search])

  // Sort
  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      let cmp = 0
      switch (sortColumn) {
        case 'time':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'market':
          cmp = (a.market?.title ?? '').localeCompare(b.market?.title ?? '')
          break
        case 'side':
          cmp = a.side.localeCompare(b.side)
          break
        case 'size':
          cmp = a.size - b.size
          break
        case 'price':
          cmp = a.price - b.price
          break
        case 'pnl':
          cmp = (a.pnl ?? 0) - (b.pnl ?? 0)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'agent':
          cmp = Number(a.isAgentTrade) - Number(b.isAgentTrade)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, sortColumn, sortDir])

  // Pagination
  const totalItems = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const endIdx = Math.min(startIdx + pageSize, totalItems)
  const pageData = sorted.slice(startIdx, endIdx)

  // Summary stats
  const stats = useMemo(() => {
    const totalTrades = filtered.length
    const totalVolume = filtered.reduce((sum, t) => sum + t.size, 0)
    const netPnl = filtered.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
    const agentCount = filtered.filter((t) => t.isAgentTrade).length
    const agentPct = totalTrades > 0 ? (agentCount / totalTrades) * 100 : 0
    const withPnl = filtered.filter((t) => t.pnl !== null)
    const wins = withPnl.filter((t) => (t.pnl ?? 0) > 0).length
    const winRate = withPnl.length > 0 ? (wins / withPnl.length) * 100 : 0
    return { totalTrades, totalVolume, netPnl, agentPct, winRate }
  }, [filtered])

  // Sort toggle
  const toggleSort = useCallback((col: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortDir('desc')
      }
      return col
    })
  }, [])

  // Reset page when filters change
  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1) }, [])
  const handleSideFilter = useCallback((v: SideFilter) => { setSideFilter(v); setPage(1) }, [])
  const handleStatusFilter = useCallback((v: StatusFilter) => { setStatusFilter(v); setPage(1) }, [])
  const handleAgentOnly = useCallback((v: boolean) => { setAgentOnly(v); setPage(1) }, [])
  const handleDateRange = useCallback((v: DateRange) => { setDateRange(v); setPage(1) }, [])

  // Sort header cell
  function SortHeader({ col, label }: { col: SortColumn; label: string }) {
    const isActive = sortColumn === col
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider transition-colors ${
          isActive ? 'text-[#00ff41]' : 'text-[#64748b] hover:text-[#94a3b8]'
        }`}
      >
        {label}
        {isActive ? (
          sortDir === 'asc' ? (
            <ArrowUp className="h-2.5 w-2.5" />
          ) : (
            <ArrowDown className="h-2.5 w-2.5" />
          )
        ) : (
          <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />
        )}
      </button>
    )
  }

  if (error) {
    return (
      <Card className="card-accent-green rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <ScrollText className="h-4 w-4 text-[#00ff41]" />
            <span className="card-title-cyber">TRADE HISTORY LOG</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load trade data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-green rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <ScrollText className="h-4 w-4 text-[#00ff41]" />
          <span className="card-title-cyber">TRADE HISTORY LOG</span>
          <span className="ml-auto text-[9px] text-[#64748b]">Complete trade records</span>
          <span className="rounded-md border border-[#00ff41]/20 bg-[#00ff41]/8 px-1.5 py-0.5 text-[9px] font-bold text-[#00ff41]">
            {stats.totalTrades}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full bg-[#1e293b]/50" />
            <Skeleton className="h-6 w-full bg-[#1e293b]/50" />
            <Skeleton className="h-40 w-full bg-[#1e293b]/50" />
          </div>
        ) : (
          <>
            {/* ─── FILTER BAR ─── */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#64748b]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search market or wallet…"
                  className="w-full rounded-md border border-[#1e293b]/60 bg-[#0a0e17]/60 py-1 pl-7 pr-2 text-[11px] text-[#e2e8f0] placeholder-[#64748b]/60 outline-none focus:border-[#00ff41]/30 transition-colors"
                />
              </div>

              {/* Side filter */}
              <FilterPill<SideFilter>
                options={['ALL', 'BUY', 'SELL']}
                value={sideFilter}
                onChange={handleSideFilter}
              />

              {/* Status filter */}
              <FilterPill<StatusFilter>
                options={['ALL', 'OPEN', 'CLOSED', 'CANCELLED']}
                value={statusFilter}
                onChange={handleStatusFilter}
              />

              {/* Date range */}
              <FilterPill<DateRange>
                options={['24h', '7D', '30D', 'ALL']}
                value={dateRange}
                onChange={handleDateRange}
              />

              {/* Agent only toggle */}
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={agentOnly}
                  onCheckedChange={handleAgentOnly}
                  className="data-[state=checked]:bg-[#00ff41]/30 h-4 w-7 [&>span]:size-3"
                />
                <span className="text-[9px] font-medium text-[#64748b]">Agent</span>
              </div>
            </div>

            {/* ─── SUMMARY STATS ─── */}
            <div className="grid grid-cols-5 gap-2">
              <div className="rounded-md border border-[#1e293b]/50 bg-[#0a0e17]/40 px-2 py-1.5 text-center">
                <div className="text-[8px] text-[#64748b] uppercase tracking-wider">Trades</div>
                <div className="font-mono text-[12px] font-bold text-[#e2e8f0]">{stats.totalTrades}</div>
              </div>
              <div className="rounded-md border border-[#1e293b]/50 bg-[#0a0e17]/40 px-2 py-1.5 text-center">
                <div className="text-[8px] text-[#64748b] uppercase tracking-wider">Volume</div>
                <div className="font-mono text-[12px] font-bold text-[#22d3ee]">{formatSize(stats.totalVolume)}</div>
              </div>
              <div className="rounded-md border border-[#1e293b]/50 bg-[#0a0e17]/40 px-2 py-1.5 text-center">
                <div className="text-[8px] text-[#64748b] uppercase tracking-wider">Net P&L</div>
                <div className={`font-mono text-[12px] font-bold ${pnlColor(stats.netPnl)}`}>
                  {formatPnl(stats.netPnl)}
                </div>
              </div>
              <div className="rounded-md border border-[#1e293b]/50 bg-[#0a0e17]/40 px-2 py-1.5 text-center">
                <div className="text-[8px] text-[#64748b] uppercase tracking-wider">Agent %</div>
                <div className="font-mono text-[12px] font-bold text-[#a855f7]">{stats.agentPct.toFixed(1)}%</div>
              </div>
              <div className="rounded-md border border-[#1e293b]/50 bg-[#0a0e17]/40 px-2 py-1.5 text-center">
                <div className="text-[8px] text-[#64748b] uppercase tracking-wider">Win Rate</div>
                <div className="font-mono text-[12px] font-bold text-[#f59e0b]">{stats.winRate.toFixed(1)}%</div>
              </div>
            </div>

            {/* ─── TRADE TABLE ─── */}
            <div className="max-h-[400px] overflow-y-auto rounded-md border border-[#1e293b]/40">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10 bg-[#0a0e17]/95 backdrop-blur-sm">
                  <tr className="border-b border-[#1e293b]/60">
                    <th className="px-2 py-1.5 text-left"><SortHeader col="time" label="Time" /></th>
                    <th className="px-2 py-1.5 text-left"><SortHeader col="market" label="Market" /></th>
                    <th className="px-2 py-1.5 text-left"><SortHeader col="side" label="Side" /></th>
                    <th className="px-2 py-1.5 text-right"><SortHeader col="size" label="Size" /></th>
                    <th className="px-2 py-1.5 text-right"><SortHeader col="price" label="Price" /></th>
                    <th className="px-2 py-1.5 text-right"><SortHeader col="pnl" label="P&L" /></th>
                    <th className="px-2 py-1.5 text-center"><SortHeader col="status" label="Status" /></th>
                    <th className="px-2 py-1.5 text-center"><SortHeader col="agent" label="Agent" /></th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[11px] text-[#64748b]">
                        No trades match filters
                      </td>
                    </tr>
                  ) : (
                    pageData.map((trade, i) => {
                      const marketTitle = trade.market?.title ?? trade.marketId
                      const truncated = truncateTitle(marketTitle)
                      const needsTooltip = marketTitle.length > 30
                      return (
                        <tr
                          key={trade.id}
                          className={`border-b border-[#1e293b]/20 transition-colors hover:bg-[#00ff41]/[0.03] ${
                            i % 2 === 0 ? 'bg-transparent' : 'bg-[#0a0e17]/30'
                          }`}
                        >
                          <td className="px-2 py-1.5 font-mono text-[10px] text-[#64748b] whitespace-nowrap">
                            {relativeTime(trade.createdAt)}
                          </td>
                          <td className="px-2 py-1.5 max-w-[180px]">
                            {needsTooltip ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default text-[11px] text-[#e2e8f0]">
                                    {truncated}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="tooltip-dark max-w-[300px]">
                                  {marketTitle}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-[11px] text-[#e2e8f0]">{truncated}</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <span
                              className={`text-[10px] font-bold ${
                                trade.side.toUpperCase() === 'BUY' ? 'text-[#00ff41]' : 'text-[#ef4444]'
                              }`}
                            >
                              {trade.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-[11px] text-[#e2e8f0]">
                            {formatSize(trade.size)}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-[11px] text-[#94a3b8]">
                            {formatPrice(trade.price)}
                          </td>
                          <td className={`px-2 py-1.5 text-right font-mono text-[11px] font-semibold ${pnlColor(trade.pnl)}`}>
                            {formatPnl(trade.pnl)}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span
                              className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-semibold ${statusBadgeColor(trade.status)}`}
                            >
                              {trade.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {trade.isAgentTrade ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center justify-center">
                                    <Brain className="h-3.5 w-3.5 text-[#a855f7]" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="tooltip-dark">
                                  Agent trade
                                  {trade.agentReasoning ? `: ${trade.agentReasoning.slice(0, 80)}` : ''}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Bot className="mx-auto h-3.5 w-3.5 text-[#1e293b]" />
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ─── PAGINATION ─── */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-[#64748b]">
                Showing {totalItems === 0 ? 0 : startIdx + 1}–{endIdx} of {totalItems} trades
              </span>

              <div className="flex items-center gap-2">
                {/* Page size selector */}
                <div className="flex items-center gap-1">
                  {([10, 25, 50] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => { setPageSize(size); setPage(1) }}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-semibold transition-all ${
                        pageSize === size
                          ? 'bg-[#00ff41]/12 text-[#00ff41] border border-[#00ff41]/25'
                          : 'text-[#64748b] border border-transparent hover:text-[#94a3b8]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                {/* Prev / Next */}
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="rounded border border-[#1e293b]/60 p-1 text-[#64748b] transition-colors hover:border-[#00ff41]/20 hover:text-[#94a3b8] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[10px] font-mono text-[#64748b]">
                  {safePage}/{totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded border border-[#1e293b]/60 p-1 text-[#64748b] transition-colors hover:border-[#00ff41]/20 hover:text-[#94a3b8] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
