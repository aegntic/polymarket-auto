'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  GitCommitHorizontal,
  Search,
  Brain,
  ArrowRightLeft,
  Pause,
  LogOut,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
} from 'lucide-react'
import { useDashboardStore, type AgentDecision } from '@/lib/store'

/* ─── Decision Type Config ─── */
const decisionConfig: Record<
  string,
  { icon: React.ElementType; color: string; dotColor: string; bg: string; label: string }
> = {
  scan: {
    icon: Search,
    color: 'text-cyan-400',
    dotColor: '#22d3ee',
    bg: 'bg-cyan-500/10',
    label: 'SCAN',
  },
  analyze: {
    icon: Brain,
    color: 'text-yellow-400',
    dotColor: '#facc15',
    bg: 'bg-yellow-500/10',
    label: 'ANALYZE',
  },
  trade: {
    icon: ArrowRightLeft,
    color: 'text-[#00ff41]',
    dotColor: '#00ff41',
    bg: 'bg-[#00ff41]/10',
    label: 'TRADE',
  },
  hold: {
    icon: Pause,
    color: 'text-gray-400',
    dotColor: '#9ca3af',
    bg: 'bg-gray-500/10',
    label: 'HOLD',
  },
  exit: {
    icon: LogOut,
    color: 'text-[#ef4444]',
    dotColor: '#ef4444',
    bg: 'bg-[#ef4444]/10',
    label: 'EXIT',
  },
}

/* ─── Outcome Config ─── */
const outcomeConfig: Record<
  string,
  { color: string; bg: string; border: string; label: string }
> = {
  success: {
    color: 'text-[#00ff41]',
    bg: 'bg-[#00ff41]/10',
    border: 'border-[#00ff41]/30',
    label: 'SUCCESS',
  },
  failure: {
    color: 'text-[#ef4444]',
    bg: 'bg-[#ef4444]/10',
    border: 'border-[#ef4444]/30',
    label: 'FAILURE',
  },
  pending: {
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    label: 'PENDING',
  },
}

/* ─── Framer Motion Variants ─── */
const timelineVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
}

/* ─── Helpers ─── */
function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? '+' : ''
  return `${sign}$${pnl.toFixed(2)}`
}

/* ─── Confidence Bar ─── */
function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const barColor =
    confidence >= 0.7 ? 'bg-[#00ff41]' : confidence >= 0.4 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#1e293b]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-[#94a3b8]">{pct}%</span>
    </div>
  )
}

/* ─── Summary Header Stats ─── */
function SummaryStats({ decisions }: { decisions: AgentDecision[] }) {
  const stats = useMemo(() => {
    const total = decisions.length
    if (total === 0) return { total: 0, successRate: 0, avgConfidence: 0 }

    const withOutcome = decisions.filter((d) => d.outcome && d.outcome !== 'pending')
    const successes = withOutcome.filter((d) => d.outcome === 'success').length
    const successRate = withOutcome.length > 0 ? (successes / withOutcome.length) * 100 : 0
    const avgConfidence = decisions.reduce((sum, d) => sum + d.confidence, 0) / total

    return { total, successRate, avgConfidence }
  }, [decisions])

  return (
    <div className="flex items-center gap-4 rounded-lg border border-[#1e293b] bg-[#0a0e17]/60 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <Activity className="h-3 w-3 text-[#a855f7]" />
        <span className="text-[10px] text-[#64748b]">Decisions</span>
        <span className="text-[11px] font-bold font-mono text-[#e2e8f0]">
          {stats.total}
        </span>
      </div>
      <div className="h-3 w-px bg-[#1e293b]" />
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3 text-[#00ff41]" />
        <span className="text-[10px] text-[#64748b]">Success</span>
        <span className="text-[11px] font-bold font-mono text-[#00ff41]">
          {stats.successRate.toFixed(0)}%
        </span>
      </div>
      <div className="h-3 w-px bg-[#1e293b]" />
      <div className="flex items-center gap-1.5">
        <Minus className="h-3 w-3 text-cyan-400" />
        <span className="text-[10px] text-[#64748b]">Avg Conf</span>
        <span className="text-[11px] font-bold font-mono text-cyan-400">
          {(stats.avgConfidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

/* ─── Timeline Item ─── */
function TimelineItem({
  decision,
  index,
}: {
  decision: AgentDecision
  index: number
}) {
  const config = decisionConfig[decision.type] || decisionConfig.hold
  const Icon = config.icon

  const outcomeKey = decision.outcome || 'pending'
  const outcome = outcomeConfig[outcomeKey] || outcomeConfig.pending

  const hasPnl = decision.pnl !== null && decision.pnl !== undefined
  const pnlPositive = hasPnl && decision.pnl! >= 0

  return (
    <motion.div
      variants={itemVariants}
      className="relative flex items-start gap-3 pl-6"
    >
      {/* Vertical connecting line */}
      <div className="absolute left-[7px] top-0 bottom-0 w-px bg-[#1e293b]" />

      {/* Colored dot on the line */}
      <div
        className="absolute left-0 top-2 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2"
        style={{
          borderColor: config.dotColor,
          backgroundColor: `${config.dotColor}22`,
          boxShadow: `0 0 6px ${config.dotColor}44`,
        }}
      >
        <div
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: config.dotColor }}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 rounded-lg border border-[#1e293b] bg-[#0a0e17]/50 px-3 py-2.5 transition-colors hover:bg-[#0a0e17]/80">
        {/* Top row: time + type badge + outcome badge */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[10px] font-mono text-[#64748b]">
            {formatTime(decision.createdAt)}
          </span>
          <div className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 ${config.bg}`}>
            <Icon className={`h-3 w-3 ${config.color}`} />
            <span className={`text-[10px] font-bold ${config.color}`}>{config.label}</span>
          </div>
          <div
            className={`flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${outcome.bg} ${outcome.border} ${outcome.color}`}
          >
            {outcome.label}
          </div>
          {/* PnL */}
          {hasPnl && (
            <span
              className={`ml-auto flex items-center gap-0.5 text-[11px] font-bold font-mono ${
                pnlPositive ? 'text-[#00ff41]' : 'text-[#ef4444]'
              }`}
            >
              {pnlPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatPnl(decision.pnl!)}
            </span>
          )}
        </div>

        {/* Confidence bar */}
        <div className="mt-2">
          <ConfidenceBar confidence={decision.confidence} />
        </div>

        {/* Reasoning */}
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-[#94a3b8]">
          {decision.reasoning}
        </p>

        {/* Action/size metadata */}
        {decision.action && (
          <div className="mt-1.5 flex items-center gap-2">
            <Badge className="h-4 border-[#1e293b] bg-[#1e293b]/50 px-1.5 text-[9px] text-[#94a3b8]">
              {decision.action}
            </Badge>
            {decision.size !== null && decision.size !== undefined && (
              <span className="text-[9px] font-mono text-[#64748b]">
                Size: ${decision.size.toFixed(2)}
              </span>
            )}
            {decision.kellyFraction !== null && decision.kellyFraction !== undefined && (
              <span className="text-[9px] font-mono text-[#64748b]">
                Kelly: {(decision.kellyFraction * 100).toFixed(1)}%
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/* ─── Main Component ─── */
export function AgentPerformanceTimeline() {
  const { data: agentData, isLoading, error } = useQuery<{
    state: Record<string, unknown>
    recentDecisions: AgentDecision[]
  }>({
    queryKey: ['agent'],
    queryFn: () => fetch('/api/agent').then((r) => r.json()),
    refetchInterval: 15000,
  })

  const liveDecisions = useDashboardStore((s) => s.agentDecisions)

  // Merge live + API decisions, deduplicate by id
  const allDecisions = useMemo(() => {
    const seen = new Set<string>()
    const result: AgentDecision[] = []
    for (const d of liveDecisions) {
      if (!seen.has(d.id)) {
        seen.add(d.id)
        result.push(d)
      }
    }
    for (const d of agentData?.recentDecisions ?? []) {
      if (!seen.has(d.id)) {
        seen.add(d.id)
        result.push(d)
      }
    }
    // Sort by createdAt descending (newest first)
    result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    return result
  }, [liveDecisions, agentData?.recentDecisions])

  return (
    <Card className="card-accent-purple border-[#1e293b] bg-[#0f1724]/80 backdrop-blur">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <GitCommitHorizontal className="h-4 w-4 text-[#a855f7]" />
          AGENT TIMELINE
          <span className="ml-auto text-[10px] font-mono text-[#64748b]">
            {allDecisions.length} entries
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        {/* Summary Stats */}
        {allDecisions.length > 0 && <SummaryStats decisions={allDecisions} />}

        {/* Timeline */}
        <ScrollArea className="mt-3 max-h-[320px]">
          {error ? (
            <p className="px-4 text-xs text-red-400">Failed to load agent data</p>
          ) : isLoading ? (
            <div className="space-y-2 px-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 pl-6">
                  <Skeleton className="h-3.5 w-3.5 rounded-full bg-[#1e293b]/50" />
                  <Skeleton className="h-16 w-full rounded-lg bg-[#1e293b]/50" />
                </div>
              ))}
            </div>
          ) : allDecisions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-[#64748b]">
              <GitCommitHorizontal className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-xs">No decisions recorded yet</p>
            </div>
          ) : (
            <motion.div
              className="relative space-y-2 pb-2 pr-1"
              variants={timelineVariants}
              initial="hidden"
              animate="visible"
            >
              {allDecisions.map((decision, index) => (
                <TimelineItem
                  key={decision.id}
                  decision={decision}
                  index={index}
                />
              ))}
            </motion.div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
