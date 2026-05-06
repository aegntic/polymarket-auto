'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, FileText, FileJson, CheckCircle2 } from 'lucide-react'
import { useDashboardStore, type Trade } from '@/lib/store'

function formatTradeTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function TradeExport() {
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null)
  const [exportSuccess, setExportSuccess] = useState<'csv' | 'json' | null>(null)

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

  const tradeCount = allTrades.length

  const exportCSV = useCallback(() => {
    setExporting('csv')
    setExportSuccess(null)

    try {
      const headers = ['Time', 'Side', 'Market', 'Size', 'Price', 'Kelly Size', 'P&L', 'Agent Trade', 'Status']
      const rows = allTrades.map((t) => [
        formatTradeTime(t.createdAt),
        t.side,
        `"${(t.market?.title ?? t.marketId).replace(/"/g, '""')}"`,
        t.size.toFixed(2),
        t.price.toFixed(4),
        t.kellySize !== null ? t.kellySize.toFixed(2) : '',
        t.pnl !== null ? t.pnl.toFixed(2) : '',
        t.isAgentTrade ? 'Yes' : 'No',
        t.status,
      ])

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `polymarket-trades-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(url)

      setExportSuccess('csv')
      setTimeout(() => setExportSuccess(null), 2500)
    } catch {
      // Graceful degradation
    } finally {
      setExporting(null)
    }
  }, [allTrades])

  const exportJSON = useCallback(() => {
    setExporting('json')
    setExportSuccess(null)

    try {
      const exportData = allTrades.map((t) => ({
        time: formatTradeTime(t.createdAt),
        side: t.side,
        market: t.market?.title ?? t.marketId,
        marketCategory: t.market?.category ?? '',
        size: t.size,
        price: t.price,
        kellySize: t.kellySize,
        pnl: t.pnl,
        isAgentTrade: t.isAgentTrade,
        agentReasoning: t.agentReasoning,
        status: t.status,
        wallet: t.wallet?.label ?? t.wallet?.address ?? t.walletId,
        isEdgeTrader: t.wallet?.isEdgeTrader ?? false,
      }))

      const jsonContent = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `polymarket-trades-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)

      setExportSuccess('json')
      setTimeout(() => setExportSuccess(null), 2500)
    } catch {
      // Graceful degradation
    } finally {
      setExporting(null)
    }
  }, [allTrades])

  if (error) {
    return (
      <Card className="card-accent-amber border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Download className="h-4 w-4 text-[#22d3ee]" />
            TRADE EXPORT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load trade data</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-amber border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <Download className="h-4 w-4 text-[#22d3ee]" />
          TRADE EXPORT
          <span className="ml-auto text-[10px] text-[#64748b]">
            {tradeCount} trades available
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full bg-[#1e293b]/50" />
            <Skeleton className="h-10 w-full bg-[#1e293b]/50" />
          </div>
        ) : (
          <>
            {/* Trade Summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-[#1e293b] bg-[#0a0e17] px-2 py-2 text-center">
                <div className="text-[9px] text-[#64748b]">Total</div>
                <div className="font-mono text-sm font-bold text-[#e2e8f0]">{tradeCount}</div>
              </div>
              <div className="rounded-md border border-[#1e293b] bg-[#0a0e17] px-2 py-2 text-center">
                <div className="text-[9px] text-[#64748b]">Agent</div>
                <div className="font-mono text-sm font-bold text-[#22d3ee]">
                  {allTrades.filter((t) => t.isAgentTrade).length}
                </div>
              </div>
              <div className="rounded-md border border-[#1e293b] bg-[#0a0e17] px-2 py-2 text-center">
                <div className="text-[9px] text-[#64748b]">With P&L</div>
                <div className="font-mono text-sm font-bold text-[#00ff41]">
                  {allTrades.filter((t) => t.pnl !== null).length}
                </div>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {/* CSV Export */}
              <button
                onClick={exportCSV}
                disabled={exporting !== null || tradeCount === 0}
                className="flex items-center justify-center gap-2 rounded-lg border border-[#1e293b] bg-[#0a0e17] px-3 py-2.5 text-xs text-[#94a3b8] transition-all hover:bg-[#1e293b]/50 hover:text-[#e2e8f0] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {exportSuccess === 'csv' ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00ff41]" />
                    <span className="text-[#00ff41]">Exported!</span>
                  </>
                ) : exporting === 'csv' ? (
                  <>
                    <FileText className="h-3.5 w-3.5 animate-pulse" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5" />
                    <span>CSV</span>
                  </>
                )}
              </button>

              {/* JSON Export */}
              <button
                onClick={exportJSON}
                disabled={exporting !== null || tradeCount === 0}
                className="flex items-center justify-center gap-2 rounded-lg border border-[#1e293b] bg-[#0a0e17] px-3 py-2.5 text-xs text-[#94a3b8] transition-all hover:bg-[#1e293b]/50 hover:text-[#e2e8f0] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {exportSuccess === 'json' ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#00ff41]" />
                    <span className="text-[#00ff41]">Exported!</span>
                  </>
                ) : exporting === 'json' ? (
                  <>
                    <FileJson className="h-3.5 w-3.5 animate-pulse" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <FileJson className="h-3.5 w-3.5" />
                    <span>JSON</span>
                  </>
                )}
              </button>
            </div>

            {/* Format Info */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 rounded-md border border-[#1e293b]/50 bg-[#0a0e17]/50 px-2.5 py-1.5">
                <FileText className="h-3 w-3 shrink-0 text-[#64748b]" />
                <div>
                  <span className="text-[9px] font-medium text-[#94a3b8]">CSV</span>
                  <span className="ml-1.5 text-[9px] text-[#64748b]">
                    Time, Side, Market, Size, Price, Kelly Size, P&L, Agent Trade, Status
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-[#1e293b]/50 bg-[#0a0e17]/50 px-2.5 py-1.5">
                <FileJson className="h-3 w-3 shrink-0 text-[#64748b]" />
                <div>
                  <span className="text-[9px] font-medium text-[#94a3b8]">JSON</span>
                  <span className="ml-1.5 text-[9px] text-[#64748b]">
                    Full trade objects with wallet & market data
                  </span>
                </div>
              </div>
            </div>

            {tradeCount === 0 && (
              <p className="text-center text-[10px] text-[#64748b]">
                No trades available for export
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
