'use client'

import { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Terminal,
  Search,
  Brain,
  ArrowRightLeft,
  Pause,
  LogOut,
  Volume2,
  VolumeX,
  ArrowRight,
} from 'lucide-react'
import { useDashboardStore, type AgentDecision } from '@/lib/store'

const decisionConfig: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  scan: { icon: Search, color: 'text-cyan-400', bg: 'bg-cyan-500/10', label: 'SCAN' },
  analyze: { icon: Brain, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'ANALYZE' },
  trade: { icon: ArrowRightLeft, color: 'text-[#00ff41]', bg: 'bg-[#00ff41]/10', label: 'TRADE' },
  hold: { icon: Pause, color: 'text-gray-400', bg: 'bg-gray-500/10', label: 'HOLD' },
  exit: { icon: LogOut, color: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', label: 'EXIT' },
}

const FLOW_STEPS = ['scan', 'analyze', 'trade']

function TimestampColor({ date }: { date: string }) {
  const [color, setColor] = useState('text-[#64748b]')

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(date).getTime()
      if (diff < 30000) setColor('text-[#00ff41]')
      else if (diff < 300000) setColor('text-[#f59e0b]')
      else setColor('text-[#64748b]')
    }
    update()
    const interval = setInterval(update, 5000)
    return () => clearInterval(interval)
  }, [date])

  const timeStr = new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  return <span className={`font-mono text-[10px] ${color}`}>{timeStr}</span>
}

function ConfidenceSparkline({ decisions }: { decisions: AgentDecision[] }) {
  const last10 = decisions.slice(0, 10).reverse()
  if (last10.length < 2) return null

  const w = 80
  const h = 20
  const points = last10
    .map((d, i) => {
      const x = (i / (last10.length - 1)) * w
      const y = h - d.confidence * (h - 2) - 1
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-[#64748b]">Conf. trend</span>
      <svg width={w} height={h} className="opacity-70">
        <polyline
          points={points}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function ReasoningChain() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5">
      {FLOW_STEPS.map((step, i) => {
        const config = decisionConfig[step]
        const Icon = config.icon
        return (
          <div key={step} className="flex items-center gap-1.5">
            <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${config.bg}`}>
              <Icon className={`h-2.5 w-2.5 ${config.color}`} />
              <span className={`text-[9px] font-bold uppercase ${config.color}`}>
                {config.label}
              </span>
            </div>
            {i < FLOW_STEPS.length - 1 && (
              <ArrowRight className="h-2.5 w-2.5 text-[#334155]" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function TypingText({ text, isNew }: { text: string; isNew: boolean }) {
  const [displayed, setDisplayed] = useState(isNew ? '' : text)
  const [typingDone, setTypingDone] = useState(!isNew)

  useEffect(() => {
    if (!isNew) return
    let index = 0
    const interval = setInterval(() => {
      if (index < text.length) {
        index += 1
        setDisplayed(text.slice(0, index))
      } else {
        setTypingDone(true)
        clearInterval(interval)
      }
    }, 15)
    return () => clearInterval(interval)
  }, [text, isNew])

  return (
    <span>
      {displayed}
      {isNew && !typingDone && (
        <span className="typing-cursor inline-block w-1 bg-cyan-400">&nbsp;</span>
      )}
    </span>
  )
}

export function AgentConsole() {
  const [muted, setMuted] = useState(true)

  const { data: agentData, isLoading, error } = useQuery<{
    state: Record<string, unknown>
    recentDecisions: AgentDecision[]
  }>({
    queryKey: ['agent'],
    queryFn: () => fetch('/api/agent').then((r) => r.json()),
    refetchInterval: 15000,
  })

  const liveDecisions = useDashboardStore((s) => s.agentDecisions)

  // Merge live + API decisions, deduplicate
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
    return result
  }, [liveDecisions, agentData?.recentDecisions])

  // Live decisions from WebSocket are considered "new" for typing animation
  const liveIds = useMemo(
    () => new Set(liveDecisions.slice(0, 3).map((d) => d.id)),
    [liveDecisions]
  )

  return (
    <Card className="card-accent-green border-[#1e293b] bg-[#0f1724]/80 backdrop-blur overflow-hidden">
      {/* Terminal Header */}
      <div className="terminal-header">
        <div className="terminal-dot bg-[#ef4444]" />
        <div className="terminal-dot bg-[#f59e0b]" />
        <div className="terminal-dot bg-[#00ff41]" />
        <span className="ml-2 text-[10px] text-[#64748b]">agent-console — polyagent@v1.0</span>
        <div className="ml-auto flex items-center gap-2">
          <ReasoningChain />
          <button
            onClick={() => setMuted(!muted)}
            className="text-[#64748b] transition-colors hover:text-[#94a3b8]"
            title={muted ? 'Unmute notifications' : 'Mute notifications'}
          >
            {muted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <CardHeader className="pb-1 pt-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-[#94a3b8]">
          <Terminal className="h-4 w-4 text-cyan-400" />
          AGENT CONSOLE
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[#00ff41]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00ff41] animate-pulse" />
            LIVE
          </span>
        </CardTitle>
        {allDecisions.length > 1 && (
          <ConfidenceSparkline decisions={allDecisions} />
        )}
      </CardHeader>
      <CardContent className="px-2">
        <ScrollArea className="h-[280px]">
          {error ? (
            <p className="px-4 text-xs text-red-400">Failed to load agent data</p>
          ) : isLoading ? (
            <div className="space-y-2 px-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-[#1e293b]/50" />
              ))}
            </div>
          ) : (
            <div className="space-y-1 px-2 font-mono text-xs">
              {allDecisions.map((decision) => {
                const config = decisionConfig[decision.type] || decisionConfig.hold
                const Icon = config.icon
                const isNew = liveIds.has(decision.id)
                return (
                  <div
                    key={decision.id}
                    className={`log-entry log-entry-type-${decision.type} flex items-start gap-2 rounded px-2 py-2 ${config.bg} ${
                      isNew ? 'animate-slide-in' : ''
                    }`}
                  >
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${config.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold uppercase ${config.color}`}>
                          {decision.type}
                        </span>
                        <TimestampColor date={decision.createdAt} />
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-[#94a3b8]">
                        <TypingText text={decision.reasoning} isNew={isNew} />
                      </p>
                      {decision.confidence > 0 && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] text-[#94a3b8]">
                            Conf:
                          </span>
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#1e293b]">
                            <div
                              className="h-full rounded-full bg-cyan-400 transition-all"
                              style={{
                                width: `${decision.confidence * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-cyan-400">
                            {(decision.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {allDecisions.length === 0 && (
                <p className="py-8 text-center text-[#64748b]">
                  No decisions yet
                </p>
              )}
              {/* Blinking cursor */}
              <div className="flex items-center gap-1 px-2 py-1 text-cyan-400">
                <span className="text-[10px]">&gt;</span>
                <span className="inline-block h-3 w-1.5 animate-pulse bg-cyan-400" />
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
