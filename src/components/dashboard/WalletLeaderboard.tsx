'use client'

import { useState, useMemo } from 'react'
import { WalletDetailModal } from './WalletDetailModal'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Trophy, TrendingUp, Filter } from 'lucide-react'
import type { Wallet } from '@/lib/store'

const rankColors = [
  'bg-amber-500 text-amber-950',  // #1 gold
  'bg-slate-300 text-slate-800',   // #2 silver
  'bg-amber-700 text-amber-100',   // #3 bronze
]

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 48
  const h = 16
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 2) - 1
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={w} height={h} className="shrink-0 opacity-70">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Seeded pseudo-random number generator for deterministic sparklines
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateSparkline(wallet: Wallet): number[] {
  const base = wallet.totalPnl
  const rand = seededRandom(wallet.id.charCodeAt(0) * 1000 + Math.abs(Math.round(wallet.edgeScore * 1000)))
  const points: number[] = []
  for (let i = 0; i < 8; i++) {
    points.push(base * (0.4 + rand() * 0.6) * (i / 7) * 0.3 + base * 0.7)
  }
  points.push(base)
  return points
}

export function WalletLeaderboard() {
  const [edgeOnly, setEdgeOnly] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null)

  const { data: wallets, isLoading, error } = useQuery<Wallet[]>({
    queryKey: ['wallets'],
    queryFn: () => fetch('/api/wallets').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const filteredWallets = useMemo(() => {
    if (!wallets) return []
    if (edgeOnly) return wallets.filter((w) => w.isEdgeTrader)
    return wallets
  }, [wallets, edgeOnly])

  const edgeCount = useMemo(
    () => (Array.isArray(wallets) ? wallets.filter((w) => w.isEdgeTrader).length : 0),
    [wallets]
  )

  // Memoize sparkline data per wallet to prevent flickering on re-renders
  const sparklineData = useMemo(() => {
    if (!wallets) return new Map<string, number[]>()
    const map = new Map<string, number[]>()
    for (const wallet of wallets) {
      map.set(wallet.id, generateSparkline(wallet))
    }
    return map
  }, [wallets])

  if (error) {
    return (
      <Card className="card-accent-green card-hover-glow card-shadow-deep border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Trophy className="h-4 w-4 text-[#00ff41]" />
            WALLET LEADERBOARD
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-red-400">Failed to load wallets</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-green card-hover-glow card-shadow-deep border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <Trophy className="h-4 w-4 text-[#00ff41]" />
          WALLET LEADERBOARD
          <div className="ml-auto flex items-center gap-2">
            {edgeCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-[#00ff41]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00ff41] animate-pulse" />
                {edgeCount} edge traders
              </span>
            )}
            <button
              onClick={() => setEdgeOnly(!edgeOnly)}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all ${
                edgeOnly
                  ? 'border-[#00ff41]/30 bg-[#00ff41]/10 text-[#00ff41]'
                  : 'border-[#1e293b] bg-transparent text-[#64748b] hover:text-[#94a3b8]'
              }`}
            >
              <Filter className="h-2.5 w-2.5" />
              {edgeOnly ? 'Edge Only' : 'All'}
            </button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        <ScrollArea className="h-[420px]">
          {isLoading ? (
            <div className="space-y-2 px-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full bg-[#1e293b]/50" />
              ))}
            </div>
          ) : (
            <div className="space-y-1 px-2">
              {filteredWallets.map((wallet, index) => (
                <div
                  key={wallet.id}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 transition-colors ${
                    wallet.isEdgeTrader
                      ? 'border border-[#00ff41]/20 bg-[#00ff41]/5 animate-edge-glow'
                      : 'border border-transparent bg-[#0a0e17]/50 hover:bg-[#1e293b]/30'
                  }`}
                  title={wallet.address}
                  onClick={() => setSelectedWallet(wallet)}
                >
                  {/* Rank Badge */}
                  {index < 3 ? (
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${rankColors[index]}`}
                    >
                      {index + 1}
                    </span>
                  ) : (
                    <span className="w-5 text-right font-mono text-[11px] font-bold text-[#64748b]">
                      {index + 1}
                    </span>
                  )}

                  {/* Main Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-mono text-xs text-[#e2e8f0] group-hover:text-white">
                        {wallet.label || truncateAddress(wallet.address)}
                      </span>
                      {wallet.isEdgeTrader && (
                        <Badge className="badge-edge h-4">
                          EDGE
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[#64748b]">
                      <span className="flex items-center gap-0.5">
                        <TrendingUp className="h-2.5 w-2.5" />
                        {(wallet.winRate * 100).toFixed(1)}%
                      </span>
                      <span>{wallet.totalTrades} trades</span>
                      <span
                        className={
                          wallet.totalPnl >= 0
                            ? 'text-[#00ff41] font-semibold'
                            : 'text-[#ef4444] font-semibold'
                        }
                      >
                        {wallet.totalPnl >= 0 ? '+' : ''}
                        {formatPnl(wallet.totalPnl)}
                      </span>
                    </div>
                    {/* Full address on hover */}
                    <div className="mt-0.5 truncate text-[9px] text-[#64748b] opacity-0 transition-opacity group-hover:opacity-100">
                      {wallet.address}
                    </div>
                  </div>

                  {/* Sparkline */}
                  <MiniSparkline
                    data={sparklineData.get(wallet.id) || [wallet.totalPnl]}
                    color={wallet.totalPnl >= 0 ? '#00ff41' : '#ef4444'}
                  />

                  {/* Edge Score Bar */}
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-mono text-xs font-bold text-[#00ff41]" title="Edge Score - Probability-weighted advantage metric (0-1)">
                      {wallet.edgeScore.toFixed(2)}
                    </span>
                    <div className="h-1 w-12 overflow-hidden rounded-full bg-[#1e293b]">
                      <div
                        className="h-full rounded-full bg-[#00ff41] transition-all"
                        style={{
                          width: `${Math.min(wallet.edgeScore * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {filteredWallets.length === 0 && (
                <p className="py-8 text-center text-xs text-[#64748b]">
                  {edgeOnly ? 'No edge traders found' : 'No wallets'}
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      {selectedWallet && (
        <WalletDetailModal
          wallet={selectedWallet}
          onClose={() => setSelectedWallet(null)}
        />
      )}
    </Card>
  )
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatPnl(pnl: number): string {
  if (Math.abs(pnl) >= 1000) {
    return `$${(pnl / 1000).toFixed(1)}k`
  }
  return `$${pnl.toFixed(0)}`
}
