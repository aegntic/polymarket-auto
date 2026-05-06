'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PieChart as PieChartIcon } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Trade } from '@/lib/store'

const CATEGORY_COLORS: Record<string, string> = {
  crypto: '#00ff41',
  economics: '#22d3ee',
  politics: '#f59e0b',
  science: '#a855f7',
  sports: '#ef4444',
}

const CATEGORY_LABELS: Record<string, string> = {
  crypto: 'Crypto',
  economics: 'Economics',
  politics: 'Politics',
  science: 'Science',
  sports: 'Sports',
}

interface AllocationData {
  name: string
  value: number
  color: string
  count: number
  dollarAmount: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: AllocationData }> }) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0].payload
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
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: data.color }}
        />
        <span className="font-semibold" style={{ color: data.color }}>
          {data.name}
        </span>
      </div>
      <div className="text-[#94a3b8]">
        Allocation: <span className="font-mono font-bold text-[#e2e8f0]">{data.value.toFixed(1)}%</span>
      </div>
      <div className="text-[#94a3b8]">
        Value: <span className="font-mono font-bold text-[#e2e8f0]">${data.dollarAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div className="text-[#94a3b8]">
        Positions: <span className="font-mono font-bold text-[#e2e8f0]">{data.count}</span>
      </div>
    </div>
  )
}

export function PortfolioAllocation() {
  const { data: trades, isLoading, error } = useQuery<Trade[]>({
    queryKey: ['trades'],
    queryFn: () => fetch('/api/trades').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const { allocationData, totalValue, activePositions } = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { allocationData: [], totalValue: 0, activePositions: 0 }
    }

    // Aggregate by market category
    const categoryMap: Record<string, { totalSize: number; count: number }> = {}

    for (const trade of trades) {
      const category = trade.market?.category ?? 'unknown'
      if (!categoryMap[category]) {
        categoryMap[category] = { totalSize: 0, count: 0 }
      }
      categoryMap[category].totalSize += trade.size * trade.price
      categoryMap[category].count += 1
    }

    const totalValue = Object.values(categoryMap).reduce((sum, c) => sum + c.totalSize, 0)
    const activePositions = Object.values(categoryMap).reduce((sum, c) => sum + c.count, 0)

    // Sort by value descending and build chart data
    const allocationData: AllocationData[] = Object.entries(categoryMap)
      .sort(([, a], [, b]) => b.totalSize - a.totalSize)
      .map(([category, data]) => ({
        name: CATEGORY_LABELS[category] ?? category.charAt(0).toUpperCase() + category.slice(1),
        value: totalValue > 0 ? (data.totalSize / totalValue) * 100 : 0,
        color: CATEGORY_COLORS[category] ?? '#64748b',
        count: data.count,
        dollarAmount: data.totalSize,
      }))

    return { allocationData, totalValue, activePositions }
  }, [trades])

  if (isLoading) {
    return (
      <Card className="card-accent-cyan border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <PieChartIcon className="h-4 w-4 text-[#a855f7]" />
            PORTFOLIO ALLOCATION
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <Skeleton className="h-[200px] w-[200px] rounded-full bg-[#1e293b]/50" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full bg-[#1e293b]/50" />
            <Skeleton className="h-4 w-3/4 bg-[#1e293b]/50" />
            <Skeleton className="h-4 w-5/6 bg-[#1e293b]/50" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || allocationData.length === 0) {
    return (
      <Card className="card-accent-cyan border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <PieChartIcon className="h-4 w-4 text-[#a855f7]" />
            PORTFOLIO ALLOCATION
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-xs text-[#64748b]">
            No allocation data available
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-accent-cyan border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
            <PieChartIcon className="h-4 w-4 text-[#a855f7]" />
            PORTFOLIO ALLOCATION
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-[#64748b]">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-[#00ff41] animate-pulse"
            />
            {activePositions} active positions
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Donut Chart */}
        <motion.div
          className="flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="relative h-[200px] w-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  animationBegin={0}
                  animationDuration={800}
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[9px] uppercase tracking-wider text-[#64748b]">
                Total Value
              </span>
              <span className="font-mono text-base font-bold text-[#e2e8f0]">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Legend */}
        <motion.div
          className="space-y-1.5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {allocationData.map((item, index) => (
            <motion.div
              key={item.name}
              className="flex items-center justify-between rounded-md border border-[#1e293b]/50 bg-[#0a0e17]/40 px-3 py-1.5"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.06, duration: 0.3 }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] font-medium text-[#94a3b8]">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="font-mono text-[11px] font-bold"
                  style={{ color: item.color }}
                >
                  {item.value.toFixed(1)}%
                </span>
                <span className="font-mono text-[10px] text-[#64748b]">
                  ${item.dollarAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </CardContent>
    </Card>
  )
}
