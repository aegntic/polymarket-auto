'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Radar, ChevronDown, ChevronUp, AlertTriangle, ArrowUpDown, Fish, ShoppingCart, TrendingUp, TrendingDown, Loader2, Check, X } from 'lucide-react'
import { useDashboardStore, type Market } from '@/lib/store'
import { useAccount, useWalletClient, usePublicClient } from 'wagmi'
import { parseUSDC } from '@/lib/trading-service'
import { toast } from 'sonner'

type SortMode = 'mispricing' | 'volume' | 'category'

const categoryColors: Record<string, string> = {
  crypto: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  politics: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  economics: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  sports: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  science: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  default: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toFixed(0)
}

// Trade Modal Component
function TradeModal({ market, onClose }: { market: Market; onClose: () => void }) {
  const [outcome, setOutcome] = useState<'YES' | 'NO'>('YES')
  const [amount, setAmount] = useState('10')
  const [trading, setTrading] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const queryClient = useQueryClient()

  const price = outcome === 'YES' ? market.yesPrice : market.noPrice
  const potentialReturn = (parseFloat(amount) / price).toFixed(2)
  const profit = (parseFloat(potentialReturn) - parseFloat(amount)).toFixed(2)

  const handleTrade = useCallback(async () => {
    if (!walletClient || !publicClient || !address) {
      toast.error('Wallet not connected')
      return
    }
    if (parseFloat(amount) <= 0 || parseFloat(amount) > 10000) {
      toast.error('Amount must be between $0.01 and $10,000')
      return
    }

    setTrading(true)
    setTxHash(null)

    try {
      // Check USDC balance first
      const usdcBalance = await publicClient.readContract({
        address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }],
        functionName: 'balanceOf',
        args: [address],
      }) as bigint

      const amountUSDC = parseUSDC(parseFloat(amount))
      if (usdcBalance < amountUSDC) {
        toast.error(`Insufficient USDC balance. You have $${(Number(usdcBalance) / 1e6).toFixed(2)} USDC`)
        setTrading(false)
        return
      }

      // Check and approve USDC allowance
      const allowance = await publicClient.readContract({
        address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        abi: [{ name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] }],
        functionName: 'allowance',
        args: [address, '0xC5d563A36AE78145C45a50134d48A1215220f80a'],
      }) as bigint

      if (allowance < amountUSDC) {
        toast.info('Approving USDC spending...')
        const approveHash = await walletClient.writeContract({
          address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
          abi: [{ name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }],
          functionName: 'approve',
          args: ['0xC5d563A36AE78145C45a50134d48A1215220f80a', amountUSDC],
        })
        await publicClient.waitForTransactionReceipt({ hash: approveHash })
        toast.success('USDC approved!')
      }

      // Place the trade via Polymarket CLOB
      const priceWei = BigInt(Math.round(price * 1_000_000))
      const sizeWei = amountUSDC
      const outcomeNum = outcome === 'YES' ? 1 : 0

      toast.info('Placing trade on Polymarket...')
      const hash = await walletClient.writeContract({
        address: '0xC5d563A36AE78145C45a50134d48A1215220f80a',
        abi: [{
          name: 'createOrder',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'marketId', type: 'uint256' },
            { name: 'outcome', type: 'uint8' },
            { name: 'price', type: 'uint256' },
            { name: 'size', type: 'uint256' },
          ],
          outputs: [{ type: 'uint256' }],
        }],
        functionName: 'createOrder',
        args: [BigInt(market.id), outcomeNum, priceWei, sizeWei],
      })

      setTxHash(hash)
      toast.success(`Trade placed! ${outcome} @ ${(price * 100).toFixed(1)}¢ for $${amount}`)

      // Record the trade in our DB
      await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: market.id,
          side: outcome,
          size: parseFloat(amount),
          price,
          isAgentTrade: false,
          status: 'pending',
          txHash: hash,
        }),
      })

      queryClient.invalidateQueries({ queryKey: ['recent-trades'] })
      queryClient.invalidateQueries({ queryKey: ['agent'] })

      setTimeout(onClose, 2000)
    } catch (error: any) {
      console.error('Trade failed:', error)
      toast.error(error?.message || 'Trade failed. Check console for details.')
    } finally {
      setTrading(false)
    }
  }, [walletClient, publicClient, address, amount, outcome, price, market, queryClient, onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div
        className="w-full max-w-md rounded-2xl border border-[#1e293b] bg-[#0f1724] p-6 shadow-2xl"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#e2e8f0]">Place Trade</h2>
            <p className="mt-0.5 text-xs text-[#64748b] line-clamp-2">{market.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#64748b] hover:bg-[#1e293b] hover:text-[#e2e8f0]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Outcome selector */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setOutcome('YES')}
            className={`rounded-xl border p-3 text-center transition-all ${
              outcome === 'YES'
                ? 'border-[#00ff41]/50 bg-[#00ff41]/10 text-[#00ff41]'
                : 'border-[#1e293b] bg-[#0a0e17]/50 text-[#64748b] hover:border-[#00ff41]/30'
            }`}
          >
            <TrendingUp className="mx-auto mb-1 h-5 w-5" />
            <div className="text-sm font-bold">YES</div>
            <div className="text-xs opacity-70">{(market.yesPrice * 100).toFixed(1)}¢</div>
          </button>
          <button
            onClick={() => setOutcome('NO')}
            className={`rounded-xl border p-3 text-center transition-all ${
              outcome === 'NO'
                ? 'border-[#ef4444]/50 bg-[#ef4444]/10 text-[#ef4444]'
                : 'border-[#1e293b] bg-[#0a0e17]/50 text-[#64748b] hover:border-[#ef4444]/30'
            }`}
          >
            <TrendingDown className="mx-auto mb-1 h-5 w-5" />
            <div className="text-sm font-bold">NO</div>
            <div className="text-xs opacity-70">{(market.noPrice * 100).toFixed(1)}¢</div>
          </button>
        </div>

        {/* Amount input */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-[#94a3b8]">Amount (USDC)</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#64748b]">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-[#1e293b] bg-[#0a0e17] py-2 pl-7 pr-3 text-sm text-[#e2e8f0] outline-none focus:border-[#00ff41]/50"
                placeholder="10.00"
                min="0.01"
                step="1"
              />
            </div>
            <div className="flex gap-1">
              {['5', '10', '25', '50'].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-all ${
                    amount === v
                      ? 'bg-[#00ff41]/20 text-[#00ff41]'
                      : 'bg-[#1e293b] text-[#64748b] hover:text-[#94a3b8]'
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Trade summary */}
        <div className="mb-4 rounded-lg border border-[#1e293b] bg-[#0a0e17]/50 p-3 text-xs">
          <div className="flex justify-between text-[#64748b]">
            <span>Price</span>
            <span className="text-[#e2e8f0]">{(price * 100).toFixed(1)}¢</span>
          </div>
          <div className="flex justify-between text-[#64748b]">
            <span>Potential return</span>
            <span className="text-[#00ff41]">${potentialReturn}</span>
          </div>
          <div className="flex justify-between text-[#64748b]">
            <span>Potential profit</span>
            <span className={parseFloat(profit) >= 0 ? 'text-[#00ff41]' : 'text-[#ef4444]'}>
              {parseFloat(profit) >= 0 ? '+' : ''}${profit}
            </span>
          </div>
        </div>

        {/* Trade button */}
        <button
          onClick={handleTrade}
          disabled={trading || !address}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00ff41]/10 py-3 text-sm font-bold text-[#00ff41] transition-all hover:bg-[#00ff41]/20 disabled:opacity-50"
        >
          {trading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {txHash ? 'Confirming...' : 'Placing Trade...'}
            </>
          ) : !address ? (
            'Connect Wallet First'
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              Buy {outcome} @ ${(parseFloat(amount) || 0).toFixed(2)}
            </>
          )}
        </button>

        {txHash && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-[#00ff41]">
            <Check className="h-3 w-3" />
            <span>Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
            <a
              href={`https://polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              View
            </a>
          </div>
        )}
      </motion.div>
    </div>
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
  const [sortMode, setSortMode] = useState<SortMode>('volume')
  const [tradeMarket, setTradeMarket] = useState<Market | null>(null)

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
    <>
      <Card className="card-accent-amber border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <Radar className="h-4 w-4 text-cyan-400" />
            MARKET SCANNER
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-[#64748b]">{mergedMarkets.length} markets</span>
              <div className="flex items-center gap-0.5 rounded-lg border border-[#1e293b] bg-[#0a0e17]/80 p-0.5">
                {([
                  { mode: 'volume' as SortMode, label: 'Volume' },
                  { mode: 'mispricing' as SortMode, label: 'Edge' },
                  { mode: 'category' as SortMode, label: 'Category' },
                ]).map(({ mode, label }) => (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    className={`flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[9px] font-bold transition-all ${
                      sortMode === mode
                        ? 'bg-[#00ff41]/15 text-[#00ff41]'
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
          <ScrollArea className="h-[500px]">
            {isLoading ? (
              <div className="space-y-2 px-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full bg-[#1e293b]/50" />
                ))}
              </div>
            ) : (
              <div className="space-y-1 px-2">
                {sortedMarkets.slice(0, 50).map((market) => {
                  const isExpanded = expandedId === market.id
                  return (
                    <div
                      key={market.id}
                      className="rounded-lg border border-transparent bg-[#0a0e17]/50 transition-colors hover:border-[#1e293b]/50 hover:bg-[#1e293b]/20"
                    >
                      <div className="flex items-start gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Badge className={`h-4 px-1.5 text-[10px] ${categoryColors[market.category] || categoryColors.default}`}>
                              {market.category}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[12px] leading-snug text-[#cbd5e1] line-clamp-2">
                            {market.title}
                          </p>
                          {/* Price bars */}
                          <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                            <div className="flex items-center gap-1">
                              <span className="w-7 text-[#00ff41]">YES</span>
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#1e293b]">
                                <div className="h-full rounded-full bg-[#00ff41]" style={{ width: `${market.yesPrice * 100}%` }} />
                              </div>
                              <span className="font-mono text-[#00ff41]">{(market.yesPrice * 100).toFixed(0)}¢</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="w-7 text-[#ef4444]">NO</span>
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#1e293b]">
                                <div className="h-full rounded-full bg-[#ef4444]" style={{ width: `${market.noPrice * 100}%` }} />
                              </div>
                              <span className="font-mono text-[#ef4444]">{(market.noPrice * 100).toFixed(0)}¢</span>
                            </div>
                            <span className="text-[9px] text-[#475569]">Vol: ${formatNumber(market.volume)}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-1">
                          <button
                            onClick={() => setTradeMarket(market)}
                            className="rounded-lg bg-[#00ff41]/10 px-2.5 py-1 text-[10px] font-bold text-[#00ff41] transition-all hover:bg-[#00ff41]/20"
                          >
                            <ShoppingCart className="mr-1 inline h-3 w-3" />
                            Trade
                          </button>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : market.id)}
                            className="text-[#64748b] hover:text-[#94a3b8]"
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-[#1e293b]/50 px-3 py-2 text-[10px] text-[#64748b]">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span>Volume: <span className="text-[#94a3b8]">${formatNumber(market.volume)}</span></span>
                            <span>Liquidity: <span className="text-[#94a3b8]">${formatNumber(market.liquidity)}</span></span>
                            {market.endDate && <span>Ends: <span className="text-[#94a3b8]">{new Date(market.endDate).toLocaleDateString()}</span></span>}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      {tradeMarket && <TradeModal market={tradeMarket} onClose={() => setTradeMarket(null)} />}
    </>
  )
}
