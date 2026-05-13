'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Calculator, AlertTriangle, BadgeCheck, TrendingUp, Bot, Loader2 } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useDashboardStore } from '@/lib/store'

interface KellyResult {
  kellyFraction: number
  optimalSize: number
  halfKelly: number
  quarterKelly: number
}

function simulateGrowth(
  bankroll: number,
  kellyFraction: number,
  winProb: number,
  odds: number,
  rounds = 50
): { round: number; full: number; half: number; quarter: number }[] {
  const data: { round: number; full: number; half: number; quarter: number }[] = []
  let f = bankroll
  let h = bankroll
  let q = bankroll
  for (let i = 1; i <= rounds; i++) {
    const win = Math.random() < winProb
    const gain = win ? odds - 1 : -1
    f = f * (1 + kellyFraction * gain)
    h = h * (1 + (kellyFraction / 2) * gain)
    q = q * (1 + (kellyFraction / 4) * gain)
    data.push({
      round: i,
      full: Math.max(f, 0),
      half: Math.max(h, 0),
      quarter: Math.max(q, 0),
    })
  }
  return data
}

export function KellySizer() {
  const [winProb, setWinProb] = useState(0.65)
  const [odds, setOdds] = useState(2.0)
  const liveCapital = useDashboardStore((s) => s.liveCapital)
  const [bankroll, setBankroll] = useState(liveCapital ?? 4237.5)
  const [result, setResult] = useState<KellyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [agentDecision, setAgentDecision] = useState<Record<string, unknown> | null>(null)
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentMarket, setAgentMarket] = useState('')
  const [displayedReasoning, setDisplayedReasoning] = useState('')
  const reasoningRef = useRef<string>('')

  // Sync bankroll with live capital from store
  useEffect(() => {
    if (liveCapital != null) {
      setBankroll(liveCapital)
    }
  }, [liveCapital])

  // Typing animation for agent reasoning
  useEffect(() => {
    if (!agentDecision?.reasoning || typeof agentDecision.reasoning !== 'string') {
      setDisplayedReasoning('')
      reasoningRef.current = ''
      return
    }
    const full = agentDecision.reasoning as string
    reasoningRef.current = full
    setDisplayedReasoning('')
    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayedReasoning(full.slice(0, i))
      if (i >= full.length) clearInterval(interval)
    }, 15)
    return () => clearInterval(interval)
  }, [agentDecision])

  const askAgent = useCallback(async () => {
    setAgentLoading(true)
    setAgentDecision(null)
    setDisplayedReasoning('')
    try {
      const res = await fetch('/api/agent-decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newsTitle: 'Market analysis requested',
          newsSentiment: 0.2,
          marketTitle: agentMarket || 'Polymarket prediction market',
          yesPrice: 0.55,
          noPrice: 0.45,
          bankroll,
        }),
      })
      const data = await res.json()
      if (!data.error) setAgentDecision(data)
    } catch {
      // Graceful degradation
    } finally {
      setAgentLoading(false)
    }
  }, [agentMarket, bankroll])

  const calculate = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kelly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winProb, odds, bankroll }),
      })
      const data = await res.json()
      if (!data.error) {
        setResult(data)
      }
    } catch {
      // Graceful degradation
    } finally {
      setLoading(false)
    }
  }, [winProb, odds, bankroll])

  const fullKellyPct = result ? (result.kellyFraction * 100).toFixed(1) : '0.0'
  const halfKellyPct = result ? (result.halfKelly * 100).toFixed(1) : '0.0'
  const quarterKellyPct = result ? (result.quarterKelly * 100).toFixed(1) : '0.0'

  const isAggressive = result ? result.kellyFraction > 0.25 : false

  // Risk/Reward calculation
  const riskReward = useMemo(() => {
    if (!result || winProb <= 0) return null
    const lossProb = 1 - winProb
    const avgWin = odds - 1
    const avgLoss = 1
    const rr = (avgWin * winProb) / (avgLoss * lossProb)
    return rr
  }, [result, winProb, odds])

  // Simulated growth
  const growthData = useMemo(() => {
    if (!result) return []
    return simulateGrowth(bankroll, result.kellyFraction, winProb, odds)
  }, [result, bankroll, winProb, odds])

  // Comparison table
  const comparisonData = useMemo(() => {
    if (!result) return []
    return [
      {
        type: 'Full Kelly',
        fraction: result.kellyFraction,
        size: result.optimalSize,
        ev: winProb * odds * result.kellyFraction * bankroll,
        risk: 'High',
      },
      {
        type: 'Half Kelly',
        fraction: result.halfKelly,
        size: result.optimalSize / 2,
        ev: winProb * odds * (result.kellyFraction / 2) * bankroll,
        risk: 'Medium',
      },
      {
        type: 'Quarter Kelly',
        fraction: result.quarterKelly,
        size: result.optimalSize / 4,
        ev: winProb * odds * (result.kellyFraction / 4) * bankroll,
        risk: 'Low',
      },
    ]
  }, [result, winProb, odds, bankroll])

  return (
    <Card className="card-accent-amber border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <Calculator className="h-4 w-4 text-amber-400" />
          KELLY POSITION SIZER
          {isAggressive && (
            <span className="flex items-center gap-1 rounded-full border border-[#ef4444]/30 bg-[#ef4444]/10 px-2 py-0.5 text-[10px] font-bold text-[#ef4444]">
              <AlertTriangle className="h-2.5 w-2.5" />
              Aggressive
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Win Probability */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#94a3b8]">Win Probability</span>
            <span className="font-mono text-[#00ff41]">
              {(winProb * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[winProb * 100]}
            onValueChange={(v) => setWinProb(v[0] / 100)}
            min={1}
            max={99}
            step={1}
            className="py-1 [&_[data-slot=slider-range]]:bg-[#00ff41] [&_[data-slot=slider-thumb]]:border-[#00ff41]"
          />
        </div>

        {/* Odds */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#94a3b8]">Odds (decimal)</span>
            <span className="font-mono text-[#f59e0b]">{odds.toFixed(2)}</span>
          </div>
          <Input
            type="number"
            value={odds}
            onChange={(e) => setOdds(parseFloat(e.target.value) || 0)}
            min={0.01}
            step={0.1}
            className="h-8 border-[#1e293b] bg-[#0a0e17] font-mono text-xs text-[#e2e8f0] focus-visible:ring-[#00ff41]/30"
          />
        </div>

        {/* Bankroll */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#94a3b8]">Bankroll</span>
            <span className="font-mono text-[#e2e8f0]">
              ${bankroll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <Input
            type="number"
            value={bankroll}
            onChange={(e) => setBankroll(parseFloat(e.target.value) || 0)}
            min={0.01}
            step={10}
            className="h-8 border-[#1e293b] bg-[#0a0e17] font-mono text-xs text-[#e2e8f0] focus-visible:ring-[#00ff41]/30"
          />
        </div>

        {/* Risk/Reward */}
        {riskReward !== null && (
          <div className="flex items-center justify-between rounded-lg border border-[#1e293b] bg-[#0a0e17]/50 px-3 py-2">
            <span className="text-[10px] text-[#64748b]">Risk/Reward Ratio</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#1e293b]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#ef4444] to-[#00ff41]"
                  style={{ width: `${Math.min(riskReward / 3 * 100, 100)}%` }}
                />
              </div>
              <span className="font-mono text-xs font-bold text-[#00ff41]">
                {riskReward.toFixed(2)}:1
              </span>
            </div>
          </div>
        )}

        {/* Calculate Button */}
        <button
          onClick={calculate}
          disabled={loading}
          className="w-full rounded-lg border border-[#00ff41]/30 bg-[#00ff41]/10 py-2 text-xs font-bold text-[#00ff41] transition-all hover:bg-[#00ff41]/20 hover:shadow-[0_0_12px_rgba(0,255,65,0.15)] disabled:opacity-50"
        >
          {loading ? 'CALCULATING...' : 'CALCULATE KELLY'}
        </button>

        {/* AI Agent Section */}
        <div className="space-y-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94a3b8]">Market Name</span>
              <span className="text-[10px] text-[#64748b]">for AI analysis</span>
            </div>
            <Input
              type="text"
              value={agentMarket}
              onChange={(e) => setAgentMarket(e.target.value)}
              placeholder="e.g. Will BTC hit $150k?"
              className="h-8 border-[#1e293b] bg-[#0a0e17] font-mono text-xs text-[#e2e8f0] placeholder:text-[#334155] focus-visible:ring-[#22d3ee]/30"
            />
          </div>
          <button
            onClick={askAgent}
            disabled={agentLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/10 py-2 text-xs font-bold text-[#22d3ee] transition-all hover:bg-[#22d3ee]/20 hover:shadow-[0_0_12px_rgba(34,211,238,0.15)] disabled:opacity-50"
          >
            {agentLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ANALYZING...
              </>
            ) : (
              <>
                <Bot className="h-3.5 w-3.5" />
                ASK AI AGENT
              </>
            )}
          </button>
        </div>

        {/* AI Agent Decision Result */}
        {agentDecision && (
          <div className="space-y-2 rounded-lg border border-[#22d3ee]/20 bg-[#0a0e17]/80 p-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#22d3ee]" />
              <span className="text-xs font-bold text-[#22d3ee]">AI AGENT DECISION</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-[#1e293b] bg-[#0a0e17] p-2">
                <div className="text-[9px] text-[#64748b]">Decision</div>
                <div className={`font-mono text-sm font-bold ${
                  agentDecision.decision === 'BUY YES' ? 'text-[#00ff41]' :
                  agentDecision.decision === 'BUY NO' ? 'text-[#ef4444]' :
                  'text-[#f59e0b]'
                }`}>
                  {String(agentDecision.decision)}
                </div>
              </div>
              <div className="rounded-md border border-[#1e293b] bg-[#0a0e17] p-2">
                <div className="text-[9px] text-[#64748b]">Confidence</div>
                <div className="font-mono text-sm font-bold text-[#22d3ee]">
                  {typeof agentDecision.confidence === 'number' ? `${(agentDecision.confidence as number * 100).toFixed(1)}%` : String(agentDecision.confidence)}
                </div>
              </div>
              <div className="rounded-md border border-[#1e293b] bg-[#0a0e17] p-2">
                <div className="text-[9px] text-[#64748b]" title="Probability-weighted advantage metric (0-1)">Edge</div>
                <div className="font-mono text-sm font-bold text-[#00ff41]">
                  {typeof agentDecision.edge === 'number' ? `${agentDecision.edge as number}bp` : String(agentDecision.edge)}
                </div>
              </div>
              <div className="rounded-md border border-[#1e293b] bg-[#0a0e17] p-2">
                <div className="text-[9px] text-[#64748b]">Position Size</div>
                <div className="font-mono text-sm font-bold text-[#e2e8f0]">
                  {typeof agentDecision.positionSize === 'number' ? `$${(agentDecision.positionSize as number).toFixed(2)}` : String(agentDecision.positionSize ?? '-')}
                </div>
              </div>
            </div>
            {/* Probability Comparison */}
            {(typeof agentDecision.trueProbability === 'number' || typeof agentDecision.impliedProbability === 'number') && (
              <div className="flex items-center justify-between rounded-md border border-[#1e293b] bg-[#0a0e17] px-3 py-2">
                <span className="text-[10px] text-[#64748b]">True vs Implied Prob</span>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-[#22d3ee]">{typeof agentDecision.trueProbability === 'number' ? `${(agentDecision.trueProbability as number * 100).toFixed(1)}%` : '-'}</span>
                  <span className="text-[#64748b]">vs</span>
                  <span className="text-[#94a3b8]">{typeof agentDecision.impliedProbability === 'number' ? `${(agentDecision.impliedProbability as number * 100).toFixed(1)}%` : '-'}</span>
                </div>
              </div>
            )}
            {/* Reasoning with typing animation */}
            {displayedReasoning && (
              <div className="rounded-md border border-[#1e293b] bg-[#0a0e17] p-2">
                <div className="text-[9px] text-[#64748b]">Reasoning</div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#94a3b8]">
                  {displayedReasoning}
                  {displayedReasoning.length < (reasoningRef.current?.length ?? 0) && (
                    <span className="inline-block h-3 w-1.5 animate-pulse bg-[#22d3ee]" />
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Aggressive Warning */}
        {isAggressive && (
          <div className="flex items-center gap-2 rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/5 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#ef4444]" />
            <span className="text-[10px] text-[#ef4444]">
              Kelly fraction &gt; 25% — Consider using half-Kelly for lower variance
            </span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3 rounded-lg border border-[#1e293b] bg-[#0a0e17]/80 p-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-[#64748b]" title="Optimal bet size based on edge and odds - full fraction">Full Kelly</div>
                <div className="font-mono text-sm font-bold text-[#00ff41] glow-green">
                  {fullKellyPct}%
                </div>
              </div>
              <div className="relative">
                <div className="flex items-center justify-center gap-1">
                  <div className="text-[10px] text-[#64748b]" title="Optimal bet size based on edge and odds - half fraction (recommended)">Half Kelly</div>
                  <BadgeCheck className="h-3 w-3 text-[#f59e0b]" />
                </div>
                <div className="font-mono text-sm font-bold text-[#f59e0b] glow-amber">
                  {halfKellyPct}%
                </div>
                <span className="text-[8px] text-[#f59e0b]/60">Recommended</span>
              </div>
              <div>
                <div className="text-[10px] text-[#64748b]" title="Optimal bet size based on edge and odds - quarter fraction">Quarter Kelly</div>
                <div className="font-mono text-sm font-bold text-[#94a3b8]">
                  {quarterKellyPct}%
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-[10px] text-[#64748b]">Optimal Size</div>
              <div className="font-mono text-lg font-bold text-[#00ff41] glow-green">
                ${result.optimalSize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Position Size Bar */}
            <div className="space-y-1">
              <div className="h-3 w-full overflow-hidden rounded-full bg-[#1e293b]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00ff41] to-[#f59e0b] transition-all"
                  style={{
                    width: `${Math.min(result.kellyFraction * 100, 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-[#64748b]">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="overflow-hidden rounded border border-[#1e293b]">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-[#1e293b] bg-[#0a0e17]">
                    <th className="px-2 py-1.5 text-left text-[#64748b]">Strategy</th>
                    <th className="px-2 py-1.5 text-right text-[#64748b]">Size</th>
                    <th className="px-2 py-1.5 text-right text-[#64748b]" title="Expected Value - the statistical edge of a trade">EV</th>
                    <th className="px-2 py-1.5 text-right text-[#64748b]">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row) => (
                    <tr key={row.type} className="border-b border-[#1e293b]/50 last:border-0">
                      <td className="px-2 py-1.5 text-[#94a3b8]">{row.type}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-[#e2e8f0]">
                        ${row.size.toFixed(0)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[#00ff41]">
                        ${row.ev.toFixed(0)}
                      </td>
                      <td className={`px-2 py-1.5 text-right ${
                        row.risk === 'High' ? 'text-[#ef4444]'
                        : row.risk === 'Medium' ? 'text-[#f59e0b]'
                        : 'text-[#00ff41]'
                      }`}>
                        {row.risk}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Projected Growth Simulation */}
            {growthData.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-[10px] text-[#64748b]">
                  <TrendingUp className="h-3 w-3" />
                  Projected Growth (simulated)
                </div>
                <div className="h-[100px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <XAxis dataKey="round" hide />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f1724',
                          border: '1px solid #1e293b',
                          borderRadius: '6px',
                          fontSize: '10px',
                          color: '#e2e8f0',
                        }}
                        formatter={(value: number) => [`$${value.toFixed(0)}`]}
                      />
                      <Line type="monotone" dataKey="full" stroke="#00ff41" strokeWidth={1.5} dot={false} name="Full" />
                      <Line type="monotone" dataKey="half" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Half" />
                      <Line type="monotone" dataKey="quarter" stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 2" dot={false} name="Quarter" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
