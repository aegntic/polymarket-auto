'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Target, Eye, EyeOff } from 'lucide-react'

/* ─── Types ─── */
interface StrategyMetrics {
  totalReturn: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  avgTradeSize: number
  totalTrades: number
  profitFactor: number
  calmarRatio: number
}

interface StrategyConfig {
  name: string
  color: string
  description: string
}

interface StrategyData {
  name: string
  color: string
  description: string
  metrics: StrategyMetrics | null
}

/* ─── Strategy Definitions ─── */
const STRATEGY_OPTIONS: StrategyConfig[] = [
  { name: 'Kelly Optimal', color: '#00ff41', description: 'Aggressive Kelly criterion sizing' },
  { name: 'Half Kelly', color: '#22d3ee', description: 'Conservative half-Kelly sizing' },
  { name: 'Fixed 5%', color: '#f59e0b', description: 'Fixed 5% position sizing' },
  { name: 'Momentum', color: '#a855f7', description: 'Trend-following strategy' },
  { name: 'Mean Revert', color: '#ef4444', description: 'Contrarian strategy' },
]

export function StrategyComparison() {
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([
    'Kelly Optimal',
    'Half Kelly',
    'Fixed 5%',
  ])
  const [visibleStrategies, setVisibleStrategies] = useState<Set<string>>(
    new Set(['Kelly Optimal', 'Half Kelly', 'Fixed 5%'])
  )

  const activeStrategyData = useMemo(() => {
    return selectedStrategies.map(name => ({
      name,
      color: STRATEGY_OPTIONS.find(s => s.name === name)?.color || '#64748b',
      description: STRATEGY_OPTIONS.find(s => s.name === name)?.description || '',
      metrics: null as StrategyMetrics | null,
    }))
  }, [selectedStrategies])

  const toggleStrategyVisibility = (name: string) => {
    setVisibleStrategies(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const handleStrategyChange = (slotIndex: number, newName: string) => {
    setSelectedStrategies(prev => {
      const next = [...prev]
      const oldName = next[slotIndex]
      next[slotIndex] = newName
      setVisibleStrategies(vis => {
        const nextVis = new Set(vis)
        if (oldName && nextVis.has(oldName) && !next.includes(oldName)) {
          nextVis.delete(oldName)
        }
        nextVis.add(newName)
        return nextVis
      })
      return next
    })
  }

  return (
    <Card className="card-accent-red card-shadow-deep chart-gradient-bg rounded-xl border border-[#1e293b]/60 bg-[#0f1724]/70 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#ef4444]" />
            <span className="card-title-cyber">STRATEGY COMPARISON</span>
          </div>
          <span className="text-[10px] text-[#64748b]">Connect wallet to compare strategies</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {selectedStrategies.map((selectedName, slotIndex) => {
            const config = STRATEGY_OPTIONS.find((s) => s.name === selectedName)!
            const isVisible = visibleStrategies.has(selectedName)
            return (
              <div key={slotIndex} className="flex items-center gap-1.5">
                <div
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all duration-200"
                  style={{
                    backgroundColor: isVisible ? `${config.color}10` : 'transparent',
                    borderColor: isVisible ? `${config.color}40` : '#1e293b',
                    opacity: isVisible ? 1 : 0.5,
                  }}
                >
                  <button
                    onClick={() => toggleStrategyVisibility(selectedName)}
                    className="flex items-center gap-1.5"
                    title={isVisible ? 'Hide strategy' : 'Show strategy'}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full transition-all"
                      style={{
                        backgroundColor: config.color,
                        boxShadow: isVisible ? `0 0 6px ${config.color}60` : 'none',
                      }}
                    />
                    {isVisible ? (
                      <Eye className="h-3 w-3" style={{ color: config.color }} />
                    ) : (
                      <EyeOff className="h-3 w-3 text-[#64748b]" />
                    )}
                  </button>
                  <select
                    value={selectedName}
                    onChange={(e) => handleStrategyChange(slotIndex, e.target.value)}
                    className="h-5 border-0 bg-transparent font-mono text-[10px] font-bold outline-none"
                    style={{ color: config.color }}
                  >
                    {STRATEGY_OPTIONS.map((opt) => (
                      <option key={opt.name} value={opt.name} className="bg-[#0a0e17] text-[#e2e8f0]">
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>

        <div className="h-[240px] w-full flex items-center justify-center text-[#64748b] text-xs">
          Strategy performance data requires connected wallet
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e293b]/50">
                <th className="pb-1.5 pr-3 text-left font-mono text-[9px] font-semibold uppercase tracking-wider text-[#64748b]">
                  Metric
                </th>
                {activeStrategyData.map((s) => (
                  <th
                    key={s.name}
                    className="pb-1.5 px-2 text-right font-mono text-[9px] font-semibold uppercase tracking-wider"
                    style={{ color: s.color }}
                  >
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#1e293b]/30">
                <td className="py-1.5 pr-3 text-[8px] text-[#64748b]">Total Return</td>
                {activeStrategyData.map(s => (
                  <td key={s.name} className="py-1.5 px-2 text-right font-mono text-[9px] text-[#64748b]">--</td>
                ))}
              </tr>
              <tr className="border-b border-[#1e293b]/30">
                <td className="py-1.5 pr-3 text-[8px] text-[#64748b]">Sharpe Ratio</td>
                {activeStrategyData.map(s => (
                  <td key={s.name} className="py-1.5 px-2 text-right font-mono text-[9px] text-[#64748b]">--</td>
                ))}
              </tr>
              <tr className="border-b border-[#1e293b]/30">
                <td className="py-1.5 pr-3 text-[8px] text-[#64748b]">Max Drawdown</td>
                {activeStrategyData.map(s => (
                  <td key={s.name} className="py-1.5 px-2 text-right font-mono text-[9px] text-[#64748b]">--</td>
                ))}
              </tr>
              <tr className="border-b border-[#1e293b]/30">
                <td className="py-1.5 pr-3 text-[8px] text-[#64748b]">Win Rate</td>
                {activeStrategyData.map(s => (
                  <td key={s.name} className="py-1.5 px-2 text-right font-mono text-[9px] text-[#64748b]">--</td>
                ))}
              </tr>
              <tr>
                <td className="py-1.5 pr-3 text-[8px] text-[#64748b]">Profit Factor</td>
                {activeStrategyData.map(s => (
                  <td key={s.name} className="py-1.5 px-2 text-right font-mono text-[9px] text-[#64748b]">--</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
