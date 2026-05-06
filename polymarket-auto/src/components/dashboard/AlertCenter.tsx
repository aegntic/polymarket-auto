'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  BellOff,
  ArrowLeftRight,
  Radar,
  TrendingUp,
  Settings,
  AlertTriangle,
  CheckCheck,
  X,
} from 'lucide-react'
import { useDashboardStore, type Trade, type AgentDecision, type Market, type NewsEvent } from '@/lib/store'

// ──────────────────────────────────────────────
// Alert-to-Toast type mapping
// ──────────────────────────────────────────────

function alertTypeToToastType(alertType: Alert['type']): 'success' | 'warning' | 'error' | 'info' | 'system' {
  switch (alertType) {
    case 'trade': return 'success'
    case 'cluster': return 'warning'
    case 'price': return 'info'
    case 'system': return 'system'
    case 'risk': return 'error'
  }
}

// ──────────────────────────────────────────────
// Alert Data Structure
// ──────────────────────────────────────────────

interface Alert {
  id: string
  type: 'trade' | 'cluster' | 'price' | 'system' | 'risk'
  title: string
  description: string
  timestamp: Date
  read: boolean
  actionUrl?: string
}

// ──────────────────────────────────────────────
// Type Configuration
// ──────────────────────────────────────────────

const TYPE_CONFIG: Record<
  Alert['type'],
  { icon: React.ElementType; color: string; label: string }
> = {
  trade: { icon: ArrowLeftRight, color: '#00ff41', label: 'Trades' },
  cluster: { icon: Radar, color: '#f59e0b', label: 'Clusters' },
  price: { icon: TrendingUp, color: '#22d3ee', label: 'Price' },
  system: { icon: Settings, color: '#a855f7', label: 'System' },
  risk: { icon: AlertTriangle, color: '#ef4444', label: 'System' },
}

type FilterTab = 'all' | 'trade' | 'cluster' | 'price' | 'system'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'trade', label: 'Trades' },
  { key: 'cluster', label: 'Clusters' },
  { key: 'price', label: 'Price' },
  { key: 'system', label: 'System' },
]

// ──────────────────────────────────────────────
// Relative time helper
// ──────────────────────────────────────────────

function relativeTime(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ──────────────────────────────────────────────
// Alert ID counter
// ──────────────────────────────────────────────

let alertCounter = 0
function nextAlertId(): string {
  alertCounter += 1
  return `alert-${Date.now()}-${alertCounter}`
}

// ──────────────────────────────────────────────
// System alert messages (simulated periodic alerts)
// ──────────────────────────────────────────────

const SYSTEM_ALERTS = [
  { title: 'Agent Model Recalibrated', description: 'Neural network weights updated. New confidence baseline: 94.7%' },
  { title: 'Risk Threshold Adjusted', description: 'Max drawdown limit tightened to 8% based on recent volatility' },
  { title: 'WebSocket Heartbeat OK', description: 'Real-time data connection verified. Latency: 11ms' },
  { title: 'Cache Invalidated', description: 'Market data cache refreshed. 847 entries updated' },
  { title: 'Kelly Fraction Auto-Tuned', description: 'Optimal Kelly adjusted to 0.23 based on rolling win rate' },
  { title: 'Edge Detection Sweep', description: 'Scanned 10,000 wallets. 2 new edge traders flagged' },
  { title: 'Strategy Backtest Complete', description: '30-day backtest finished. Sharpe: 2.14, Max DD: 6.3%' },
  { title: 'Liquidity Monitor', description: 'Market depth below threshold on BTC market. Slippage risk elevated' },
  { title: 'Sentiment Divergence', description: 'News sentiment (+0.4) diverges from market pricing (-0.1). Potential edge.' },
  { title: 'Portfolio Rebalanced', description: 'Position sizes adjusted per Kelly criterion. Capital reallocated.' },
]

const RISK_ALERTS = [
  { title: 'Drawdown Warning', description: 'Portfolio drawdown reached 6.2%. Approaching 8% risk limit.' },
  { title: 'Concentration Risk', description: '72% of capital in crypto markets. Diversification recommended.' },
  { title: 'High Volatility Alert', description: 'Market volatility spike detected. VIX equivalent: 34.2' },
  { title: 'Correlation Breakdown', description: 'Historical correlations no longer holding. Model uncertainty increased.' },
]

// ──────────────────────────────────────────────
// Alert generators (pure functions)
// ──────────────────────────────────────────────

function createTradeAlert(trade: Trade): Alert {
  const isAgent = trade.isAgentTrade
  const side = trade.side
  const marketTitle = trade.market?.title || 'Unknown Market'
  const walletLabel = trade.wallet?.label || trade.walletId

  return {
    id: nextAlertId(),
    type: 'trade',
    title: isAgent
      ? `Agent ${side === 'YES' ? 'Bought YES' : 'Bought NO'}`
      : `Whale Trade: ${side}`,
    description: isAgent
      ? `${marketTitle} — $${trade.size.toFixed(0)} at ${(trade.price * 100).toFixed(1)}¢ (Kelly: ${trade.kellySize !== null ? `$${trade.kellySize}` : 'N/A'})`
      : `${walletLabel} placed ${side} on ${marketTitle} — $${trade.size.toFixed(0)}`,
    timestamp: new Date(trade.createdAt),
    read: false,
  }
}

function createDecisionAlert(decision: AgentDecision): Alert {
  const action = decision.action || decision.type.toUpperCase()
  const confidence = (decision.confidence * 100).toFixed(0)

  return {
    id: nextAlertId(),
    type: 'cluster',
    title: `Agent Decision: ${action}`,
    description: `Confidence: ${confidence}% — ${decision.reasoning.slice(0, 80)}${decision.reasoning.length > 80 ? '...' : ''}`,
    timestamp: new Date(decision.createdAt),
    read: false,
  }
}

function createMarketAlert(market: Market): Alert {
  const yesPercent = (market.yesPrice * 100).toFixed(1)
  const mispricing = market.mispricingScore
    ? ` | Mispricing: ${(market.mispricingScore * 100).toFixed(0)}%`
    : ''

  return {
    id: nextAlertId(),
    type: 'price',
    title: `Market Update: ${market.title.slice(0, 40)}${market.title.length > 40 ? '...' : ''}`,
    description: `YES: ${yesPercent}% | Vol: $${(market.volume / 1000).toFixed(0)}K${mispricing}`,
    timestamp: new Date(),
    read: false,
  }
}

function createNewsAlert(news: NewsEvent): Alert {
  const sentiment = news.sentiment >= 0 ? '+' : ''
  const riskType = Math.abs(news.sentiment) > 0.7 && news.impactScore > 0.7

  return {
    id: nextAlertId(),
    type: riskType ? 'risk' : 'price',
    title: `News: ${news.title.slice(0, 45)}${news.title.length > 45 ? '...' : ''}`,
    description: `${news.source} | Sentiment: ${sentiment}${news.sentiment.toFixed(2)} | Impact: ${(news.impactScore * 100).toFixed(0)}%${news.agentAction ? ` | Agent: ${news.agentAction}` : ''}`,
    timestamp: new Date(news.publishedAt || news.createdAt),
    read: false,
  }
}

function createSystemAlert(): Alert {
  const isRisk = Math.random() > 0.75
  const pool = isRisk ? RISK_ALERTS : SYSTEM_ALERTS
  const template = pool[Math.floor(Math.random() * pool.length)]
  return {
    id: nextAlertId(),
    type: isRisk ? 'risk' : 'system',
    title: template.title,
    description: template.description,
    timestamp: new Date(),
    read: false,
  }
}

// ──────────────────────────────────────────────
// AlertCenter Component
// ──────────────────────────────────────────────

export function AlertCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [bellShake, setBellShake] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const prevUnreadRef = useRef(0)

  // Track processed IDs to avoid duplicates
  const processedIds = useRef<Set<string>>(new Set())

  // ── Subscribe to Zustand store for real-time events ──
  // Using store.subscribe() so setState is called in a callback,
  // not directly in the effect body (satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    const addAlerts = (newAlerts: Alert[]) => {
      if (newAlerts.length === 0) return
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 50))
      // Show a brief toast for the most recent alert
      const latest = newAlerts[0]
      useDashboardStore.getState().addToast({
        type: alertTypeToToastType(latest.type),
        title: latest.title,
        description: latest.description.slice(0, 80),
      })
    }

    const unsubscribe = useDashboardStore.subscribe((state, prevState) => {
      const batch: Alert[] = []

      // Check for new live trades
      for (const trade of state.liveTrades) {
        if (!processedIds.current.has(trade.id)) {
          processedIds.current.add(trade.id)
          batch.push(createTradeAlert(trade))
        }
      }

      // Check for new agent decisions
      for (const decision of state.agentDecisions) {
        if (!processedIds.current.has(decision.id)) {
          processedIds.current.add(decision.id)
          batch.push(createDecisionAlert(decision))
        }
      }

      // Check for new/updated markets
      for (const market of state.marketUpdates) {
        const key = market.id + '-' + market.volume
        if (!processedIds.current.has(key)) {
          processedIds.current.add(key)
          batch.push(createMarketAlert(market))
        }
      }

      // Check for new news alerts
      for (const news of state.newsAlerts) {
        if (!processedIds.current.has(news.id)) {
          processedIds.current.add(news.id)
          batch.push(createNewsAlert(news))
        }
      }

      addAlerts(batch)
    })

    // Process any items that already exist in the store on mount
    const initialState = useDashboardStore.getState()
    const initialBatch: Alert[] = []
    for (const trade of initialState.liveTrades) {
      if (!processedIds.current.has(trade.id)) {
        processedIds.current.add(trade.id)
        initialBatch.push(createTradeAlert(trade))
      }
    }
    for (const decision of initialState.agentDecisions) {
      if (!processedIds.current.has(decision.id)) {
        processedIds.current.add(decision.id)
        initialBatch.push(createDecisionAlert(decision))
      }
    }
    for (const market of initialState.marketUpdates) {
      const key = market.id + '-' + market.volume
      if (!processedIds.current.has(key)) {
        processedIds.current.add(key)
        initialBatch.push(createMarketAlert(market))
      }
    }
    for (const news of initialState.newsAlerts) {
      if (!processedIds.current.has(news.id)) {
        processedIds.current.add(news.id)
        initialBatch.push(createNewsAlert(news))
      }
    }
    addAlerts(initialBatch)

    return unsubscribe
  }, [])

  // ── Periodic system alerts (every 30-60s) ────
  useEffect(() => {
    const scheduleNext = () => {
      const delay = 30000 + Math.random() * 30000
      return setTimeout(() => {
        const alert = createSystemAlert()
        setAlerts((prev) => [alert, ...prev].slice(0, 50))
        timerRef = scheduleNext()
      }, delay)
    }

    // First system alert after 15s
    const initialTimeout = setTimeout(() => {
      const alert = createSystemAlert()
      setAlerts((prev) => [alert, ...prev].slice(0, 50))
      useDashboardStore.getState().addToast({
        type: alert.type === 'risk' ? 'error' : 'system',
        title: alert.title,
        description: alert.description.slice(0, 80),
      })
      timerRef = scheduleNext()
    }, 15000)

    let timerRef: ReturnType<typeof setTimeout> = initialTimeout

    return () => {
      clearTimeout(initialTimeout)
      clearTimeout(timerRef)
    }
  }, [])

  // ── Bell shake animation on new unread alerts ──
  useEffect(() => {
    const unreadCount = alerts.filter((a) => !a.read).length
    if (unreadCount > prevUnreadRef.current && prevUnreadRef.current >= 0) {
      // Defer setState via rAF to avoid calling it synchronously in the effect body
      const raf = requestAnimationFrame(() => {
        setBellShake(true)
        setTimeout(() => setBellShake(false), 600)
      })
      prevUnreadRef.current = unreadCount
      return () => cancelAnimationFrame(raf)
    }
    prevUnreadRef.current = unreadCount
  }, [alerts])

  // ── Close panel on outside click ─────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // ── Derived values ───────────────────────────
  const unreadCount = alerts.filter((a) => !a.read).length
  const displayCount = unreadCount > 99 ? '99+' : unreadCount.toString()

  const filteredAlerts =
    activeFilter === 'all'
      ? alerts
      : activeFilter === 'system'
        ? alerts.filter((a) => a.type === 'system' || a.type === 'risk')
        : alerts.filter((a) => a.type === activeFilter)

  // ── Handlers ─────────────────────────────────
  const handleToggle = useCallback(() => setIsOpen((prev) => !prev), [])

  const handleMarkRead = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, read: true } : a))
    )
  }, [])

  const handleMarkAllRead = useCallback(() => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })))
  }, [])

  const handleClearAll = useCallback(() => {
    setAlerts([])
  }, [])

  // ── Render ───────────────────────────────────
  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon Trigger */}
      <button
        ref={bellRef}
        onClick={handleToggle}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#1e293b]/80 bg-[#0f1724]/70 text-[#94a3b8] transition-all duration-200 hover:border-[#00ff41]/30 hover:bg-[#0f1724] hover:text-[#e2e8f0] ${
          bellShake ? 'animate-bell-shake' : ''
        } ${isOpen ? 'border-[#00ff41]/30 bg-[#0f1724] text-[#00ff41]' : ''}`}
        aria-label="Alert center"
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex min-w-[16px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[8px] font-bold text-white ${
              bellShake ? 'animate-badge-pulse' : ''
            }`}
          >
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-0 top-full z-[100] mt-2 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#1e293b]/80 bg-[#0a0e17]/95 shadow-2xl backdrop-blur-xl sm:w-[380px]"
            style={{ maxHeight: '500px' }}
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between border-b border-[#1e293b]/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-[#00ff41]" />
                <span className="card-title-cyber text-[#e2e8f0]">ALERT CENTER</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[#ef4444]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#ef4444]">
                    {displayCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {alerts.length > 0 && (
                  <>
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-medium text-[#64748b] transition-colors hover:bg-[#1e293b]/50 hover:text-[#94a3b8]"
                      title="Mark all as read"
                    >
                      <CheckCheck className="h-3 w-3" />
                      <span className="hidden sm:inline">Mark All Read</span>
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-medium text-[#64748b] transition-colors hover:bg-[#ef4444]/10 hover:text-[#ef4444]"
                      title="Clear all alerts"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── Filter Tabs ── */}
            <div className="flex items-center gap-0.5 border-b border-[#1e293b]/40 px-3 py-1.5">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`rounded-md px-2.5 py-1 text-[9px] font-semibold tracking-wide transition-all duration-150 ${
                    activeFilter === tab.key
                      ? 'bg-[#00ff41]/10 text-[#00ff41]'
                      : 'text-[#64748b] hover:bg-[#1e293b]/40 hover:text-[#94a3b8]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Alert List ── */}
            <div className="overflow-y-auto" style={{ maxHeight: '370px' }}>
              {filteredAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-[#64748b]">
                  <BellOff className="mb-2 h-8 w-8 opacity-30" />
                  <p className="text-xs font-medium">No alerts yet</p>
                  <p className="text-[10px] opacity-60">Notifications will appear here</p>
                </div>
              ) : (
                <div>
                  {filteredAlerts.map((alert, index) => {
                    const config = TYPE_CONFIG[alert.type]
                    const Icon = config.icon
                    const color = config.color

                    return (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index < 10 ? index * 0.03 : 0, duration: 0.2 }}
                        onClick={() => handleMarkRead(alert.id)}
                        className={`group flex cursor-pointer items-start gap-3 border-b border-[#1e293b]/30 px-4 py-2.5 transition-colors duration-150 hover:bg-[#1e293b]/20 ${
                          !alert.read ? 'bg-[#00ff41]/[0.03]' : ''
                        }`}
                      >
                        {/* Unread indicator */}
                        <div className="mt-1.5 flex shrink-0 flex-col items-center gap-1.5">
                          {!alert.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#00ff41] shadow-[0_0_6px_rgba(0,255,65,0.4)]" />
                          )}
                          {alert.read && <span className="h-1.5 w-1.5" />}
                        </div>

                        {/* Type icon */}
                        <div
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                          style={{ backgroundColor: `${color}10` }}
                        >
                          <Icon className="h-3 w-3" style={{ color }} />
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`truncate text-[12px] leading-tight ${
                                !alert.read ? 'font-semibold text-[#e2e8f0]' : 'font-medium text-[#94a3b8]'
                              }`}
                            >
                              {alert.title}
                            </p>
                            <span className="shrink-0 text-[9px] text-[#64748b]/70">
                              {relativeTime(alert.timestamp)}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#94a3b8]/70">
                            {alert.description}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            {filteredAlerts.length > 0 && (
              <div className="border-t border-[#1e293b]/40 px-4 py-2">
                <div className="flex items-center justify-between text-[9px] text-[#64748b]">
                  <span>
                    {alerts.length} alert{alerts.length !== 1 ? 's' : ''} · {unreadCount} unread
                  </span>
                  <span className="opacity-60">Click to mark read</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
