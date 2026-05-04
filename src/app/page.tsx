'use client'

import { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLiveData } from '@/hooks/useLiveData'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useDashboardStore, type AgentState } from '@/lib/store'
import { WalletLeaderboard } from '@/components/dashboard/WalletLeaderboard'
import { NewsFeed } from '@/components/dashboard/NewsFeed'
import { PerformanceChart } from '@/components/dashboard/PerformanceChart'
import { RiskAnalysis } from '@/components/dashboard/RiskAnalysis'
import { AgentConsole } from '@/components/dashboard/AgentConsole'
import { MarketScanner } from '@/components/dashboard/MarketScanner'
import { TradeFeed } from '@/components/dashboard/TradeFeed'
import { KellySizer } from '@/components/dashboard/KellySizer'
import { StrategyBacktest } from '@/components/dashboard/StrategyBacktest'
import { PortfolioAllocation } from '@/components/dashboard/PortfolioAllocation'
import { MatrixRain } from '@/components/dashboard/MatrixRain'
import { DeploymentTimeline } from '@/components/dashboard/DeploymentTimeline'
import { PnLHeatmap } from '@/components/dashboard/PnLHeatmap'
import { TradeExport } from '@/components/dashboard/TradeExport'
import { AgentPerformanceTimeline } from '@/components/dashboard/AgentPerformanceTimeline'
import { MarketDepth } from '@/components/dashboard/MarketDepth'
import { WalletNetworkGraph } from '@/components/dashboard/WalletNetworkGraph'
import { CorrelationMatrix } from '@/components/dashboard/CorrelationMatrix'
import { AgentStrategyPanel } from '@/components/dashboard/AgentStrategyPanel'
import { LivePriceTicker } from '@/components/dashboard/LivePriceTicker'
import { SentimentTimeline } from '@/components/dashboard/SentimentTimeline'
import { PerformanceAttribution } from '@/components/dashboard/PerformanceAttribution'
import { WalletActivityHeatmap } from '@/components/dashboard/WalletActivityHeatmap'
import { TradeClustering } from '@/components/dashboard/TradeClustering'
import { DashboardSettings } from '@/components/dashboard/DashboardSettings'
import { AlertCenter } from '@/components/dashboard/AlertCenter'
import { StrategyComparison } from '@/components/dashboard/StrategyComparison'
import { MarketSentimentGauge } from '@/components/dashboard/MarketSentimentGauge'
import { QuickActionsToolbar } from '@/components/dashboard/QuickActionsToolbar'
import { TradeHistoryLog } from '@/components/dashboard/TradeHistoryLog'
import { PortfolioTimeline } from '@/components/dashboard/PortfolioTimeline'
import { WalletComparisonTool } from '@/components/dashboard/WalletComparisonTool'
import { OrderBookDepth } from '@/components/dashboard/OrderBookDepth'
import { WalletConnectPanel } from '@/components/dashboard/WalletConnectPanel'
import { ToastNotificationSystem } from '@/components/dashboard/ToastNotificationSystem'
import { useDashboardSettings } from '@/hooks/useDashboardSettings'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Wifi,
  WifiOff,
  Cpu,
  TrendingUp,
  Target,
  BarChart3,
  Zap,
  Clock,
  Signal,
  Brain,
  Radio,
  Shield,
  Eye,
  Layers,
  Gem,
  LayoutDashboard,
  ArrowLeftRight,
  Network,
  Search,
} from 'lucide-react'

type TabKey = 'overview' | 'analytics' | 'trading' | 'risk'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'trading', label: 'Trading', icon: ArrowLeftRight },
  { key: 'risk', label: 'Risk & Strategy', icon: Shield },
]

function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  className = '',
  decimals = 2,
}: {
  value: number
  prefix?: string
  suffix?: string
  className?: string
  decimals?: number
}) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    const duration = 600
    const start = performance.now()

    const step = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + (to - from) * eased
      setDisplay(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        prevRef.current = to
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])

  const formatted =
    display >= 1000
      ? display.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : display.toFixed(decimals)

  return (
    <span className={`font-mono ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = '#00ff41',
  index = 0,
  pulse = false,
  accentBorder = false,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
  subValue?: string
  color?: string
  index?: number
  pulse?: boolean
  accentBorder?: boolean
}) {
  return (
    <motion.div
      className={`group relative flex items-center gap-2.5 rounded-xl border bg-[#0f1724]/70 px-3.5 py-2.5 backdrop-blur-sm transition-all duration-300 hover:bg-[#0f1724]/90 hover:shadow-[0_0_16px_rgba(0,255,65,0.04)] ${
        accentBorder ? 'border-[#00ff41]/20' : 'border-[#1e293b]/80'
      } ${pulse ? 'animate-metric-pulse' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      {/* Gradient accent line on left */}
      <div
        className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full opacity-60"
        style={{ backgroundColor: color }}
      />
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300"
        style={{ backgroundColor: `${color}10` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">{label}</div>
        <div className="flex items-baseline gap-1">{value}</div>
        {subValue && (
          <div className="text-[9px] text-[#64748b]/80">{subValue}</div>
        )}
      </div>
    </motion.div>
  )
}

function ElapsedCounter({ startTime }: { startTime: string | null }) {
  const [elapsed, setElapsed] = useState('00:00:00')

  useEffect(() => {
    if (!startTime) return
    const start = new Date(startTime).getTime()

    const tick = () => {
      const diff = Date.now() - start
      const hrs = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setElapsed(
        `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      )
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  return (
    <span className="font-mono text-[11px] font-semibold text-cyan-400 glow-cyan">{elapsed}</span>
  )
}

function SystemStatus() {
  const items = [
    { icon: Clock, label: 'Uptime', value: '99.97%', color: '#00ff41' },
    { icon: Signal, label: 'Latency', value: '12ms', color: '#00ff41' },
    { icon: Brain, label: 'Model Acc.', value: '94.2%', color: '#f59e0b' },
    { icon: Radio, label: 'Active Mkt.', value: '8', color: '#22d3ee' },
  ]

  return (
    <div className="flex items-center gap-5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <item.icon className="h-3 w-3" style={{ color: item.color }} />
          <span className="text-[10px] text-[#64748b]">{item.label}</span>
          <span className="text-[11px] font-mono font-semibold" style={{ color: item.color }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const liveData = useLiveData()

  const { openConnectModal } = useConnectModal()
  const wsConnected = useDashboardStore((s) => s.wsConnected)

  const { settings } = useDashboardSettings()
  const gridGap = settings.compactMode ? 'gap-3' : 'gap-5'
  const sectionMb = settings.compactMode ? 'mb-3' : 'mb-5'

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window === 'undefined') return 'overview'
    try {
      const saved = localStorage.getItem('polyagent-active-tab')
      if (saved && ['overview', 'analytics', 'trading', 'risk'].includes(saved)) {
        return saved as TabKey
      }
    } catch {}
    return 'overview'
  })

  // Save tab to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('polyagent-active-tab', activeTab)
    } catch {}
  }, [activeTab])

  const { data: agentData } = useQuery<{
    state: AgentState
    recentDecisions: unknown[]
  }>({
    queryKey: ['agent'],
    queryFn: () => fetch('/api/agent').then((r) => r.json()),
    refetchInterval: 15000,
  })

  const walletAddress = useDashboardStore((s) => s.walletAddress)
  const walletBalance = useDashboardStore((s) => s.walletBalance)
  const liveCapital = useDashboardStore((s) => s.liveCapital)
  const agent = agentData?.state

  // Show "Connect Wallet" when disconnected, real balance when connected
  const displayCapital = walletAddress
    ? (walletBalance ?? liveCapital ?? agent?.currentCapital ?? null)
    : null

  const currentCapital = displayCapital
  const pnlPercent =
    currentCapital !== null && agent && agent.capitalBase > 0
      ? (((currentCapital - agent.capitalBase) / agent.capitalBase) * 100).toFixed(0)
      : null
  const totalTrades = agent?.totalTrades ?? 0
  const winRate = agent?.winRate ?? 0
  const sharpe = agent?.sharpeRatio ?? 0

  const returnMultiple =
    currentCapital !== null && agent && agent.capitalBase > 0
      ? (currentCapital / agent.capitalBase).toFixed(1)
      : null

  return (
    <div
      className="flex min-h-screen flex-col bg-[#0a0e17] text-[#e2e8f0] scanline-overlay grid-pattern-overlay"
      style={{ '--anim-speed': settings.animationSpeed } as React.CSSProperties}
      data-card-style={settings.cardStyle}
    >
      <ToastNotificationSystem />
      {/* Matrix Rain Background */}
      <MatrixRain enabled={settings.matrixRain} />

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-[#1e293b]/80 bg-[#0a0e17]/95 px-4 py-2.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center gap-4">
          {/* Logo */}
          <motion.div
            className="flex items-center gap-2.5"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#00ff41]/30 bg-[#00ff41]/10 shadow-[0_0_12px_rgba(0,255,65,0.1)] card-shadow-deep">
              <Cpu className="h-4 w-4 text-[#00ff41]" />
              <div className="absolute inset-0 rounded-xl bg-[#00ff41]/5 animate-pulse" />
            </div>
            <span className="text-lg font-black tracking-wider text-[#00ff41]">
              POLYAGENT
            </span>
          </motion.div>

          {/* Key Metrics */}
          <div className="hidden flex-1 flex-wrap items-center gap-2 md:flex">
            <MetricCard
              icon={Layers}
              label="Starting Capital"
              index={0}
              value={
                <AnimatedCounter
                  value={agent?.capitalBase ?? 25}
                  prefix="$"
                  className="text-xs text-[#94a3b8]"
                />
              }
              color="#475569"
            />
            <MetricCard
              icon={Zap}
              label="Current Capital"
              index={1}
              pulse
              accentBorder
              value={
                currentCapital !== null ? (
                  <AnimatedCounter
                    value={currentCapital}
                    prefix="$"
                    className="text-sm font-bold text-[#00ff41] glow-green"
                  />
                ) : (
                  <button 
                    onClick={() => openConnectModal()}
                    className="text-sm font-bold text-[#64748b] hover:text-[#00ff41] transition-colors cursor-pointer bg-transparent border-none p-0"
                  >
                    Connect Wallet
                  </button>
                )
              }
              color="#00ff41"
            />
            <MetricCard
              icon={TrendingUp}
              label="Total P&L"
              index={2}
              value={
                <AnimatedCounter
                  value={parseFloat(pnlPercent)}
                  suffix="%"
                  className="text-sm font-bold text-[#00ff41] glow-green"
                  decimals={0}
                />
              }
              subValue={`${returnMultiple}x return`}
              color="#00ff41"
            />
            <MetricCard
              icon={Gem}
              label="Win Rate"
              index={3}
              value={
                <AnimatedCounter
                  value={winRate * 100}
                  suffix="%"
                  className="text-sm font-bold text-[#f59e0b]"
                  decimals={1}
                />
              }
              color="#f59e0b"
            />
            <MetricCard
              icon={Activity}
              label="Total Trades"
              index={4}
              value={
                <span className="font-mono text-sm font-bold text-[#e2e8f0]">
                  {totalTrades}
                </span>
              }
              color="#94a3b8"
            />
            <MetricCard
              icon={BarChart3}
              label="Sharpe Ratio"
              index={5}
              value={
                <AnimatedCounter
                  value={sharpe}
                  className="text-sm font-bold text-cyan-400 glow-cyan"
                />
              }
              color="#22d3ee"
            />
          </div>

          {/* Agent Status */}
          <div className="relative flex items-center gap-2">
            <AlertCenter />
            <div className="hidden items-center gap-2 rounded-lg border border-[#00ff41]/20 bg-[#00ff41]/5 px-3 py-1.5 sm:flex animate-border-glow">
              <Shield className="h-3 w-3 text-[#00ff41]/60" />
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#00ff41]" />
              <span className="text-[10px] font-bold tracking-widest text-[#00ff41] glow-green">
                AUTONOMOUS
              </span>
            </div>
          </div>
        </div>

        {/* System Status Row */}
        <div className="mx-auto mt-1.5 flex max-w-[1800px] items-center justify-between gap-4 border-t border-[#1e293b]/30 pt-1.5">
          <div className="flex items-center gap-1.5 text-[9px] text-[#475569]">
            <Clock className="h-3 w-3 text-cyan-400" />
            <span>Elapsed:</span>
            <ElapsedCounter startTime={agent?.startedAt ?? null} />
          </div>
          <div className="hidden xl:block">
            <SystemStatus />
          </div>
        </div>
      </header>
      <div className="header-gradient-line" />

      {/* ─── LIVE PRICE TICKER ─── */}
      <LivePriceTicker />

      {/* ─── TAB BAR ─── */}
      <div className="sticky top-[calc(var(--header-h,80px))] z-40 border-b border-[#1e293b]/60 bg-[#0f1724]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[1800px]">
          <nav className="tab-scroll flex items-center gap-0.5 px-4" aria-label="Dashboard tabs">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-xs font-semibold tracking-wide transition-all duration-200 ${
                    isActive
                      ? 'bg-[#00ff41]/10 text-[#00ff41] border-b-2 border-[#00ff41]'
                      : 'text-[#475569] hover:text-[#94a3b8] border-b-2 border-transparent'
                  }`}
                  aria-selected={isActive}
                  role="tab"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* ─── TAB CONTENT ─── */}
      <main
        className={`mobile-compact relative z-10 flex-1 ${settings.compactMode ? 'p-2 sm:p-3' : 'p-3 sm:p-5'}`}
        data-compact={settings.compactMode}
      >
        <div className="mx-auto max-w-[1800px]">
          <AnimatePresence mode="wait">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                className="animate-tab-fade"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                {/* PerformanceChart - full width at top */}
                <div className={sectionMb}>
                  <PerformanceChart />
                </div>
                <div className="glow-divider" />
                {/* PortfolioTimeline - full width */}
                <div className={sectionMb}>
                  <PortfolioTimeline />
                </div>
                <div className="glow-divider" />
                <div className={`grid grid-cols-1 ${gridGap} lg:grid-cols-2`}>
                  <div className={`flex flex-col ${gridGap}`}>
                    <WalletLeaderboard />
                    <NewsFeed />
                  </div>
                  <div className={`flex flex-col ${gridGap}`}>
                    <AgentConsole />
                    <TradeFeed />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                className="animate-tab-fade"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#00ff41]/10">
                    <Network className="h-3 w-3 text-[#00ff41]" />
                  </div>
                  <h2 className="card-title-cyber">NETWORK &amp; ACTIVITY</h2>
                  <div className="flex-1 border-b border-[#1e293b]/30" />
                </div>
                <div className={`grid grid-cols-1 ${gridGap} lg:grid-cols-2`}>
                  <div className={`flex flex-col ${gridGap}`}>
                    <WalletNetworkGraph />
                    <WalletActivityHeatmap />
                    <PnLHeatmap />
                    <SentimentTimeline />
                    <WalletComparisonTool />
                  </div>
                  <div className={`flex flex-col ${gridGap}`}>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#22d3ee]/10">
                        <Search className="h-3 w-3 text-[#22d3ee]" />
                      </div>
                      <h2 className="card-title-cyber">PATTERNS &amp; INSIGHTS</h2>
                      <div className="flex-1 border-b border-[#1e293b]/30" />
                    </div>
                    <MarketSentimentGauge />
                    <CorrelationMatrix />
                    <TradeClustering />
                    <PerformanceAttribution />
                    <AgentPerformanceTimeline />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Trading Tab */}
            {activeTab === 'trading' && (
              <motion.div
                key="trading"
                className="animate-tab-fade"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className={`grid grid-cols-1 ${gridGap} lg:grid-cols-2`}>
                  <div className={`flex flex-col ${gridGap}`}>
                    <WalletConnectPanel />
                    <MarketScanner />
                    <MarketDepth />
                    <KellySizer />
                    <OrderBookDepth />
                  </div>
                  <div className={`flex flex-col ${gridGap}`}>
                    <StrategyBacktest />
                    <PortfolioAllocation />
                    <TradeExport />
                    <TradeHistoryLog />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Risk & Strategy Tab */}
            {activeTab === 'risk' && (
              <motion.div
                key="risk"
                className="animate-tab-fade"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <div className={sectionMb}>
                  <DeploymentTimeline />
                </div>
                <div className={`grid grid-cols-1 ${gridGap} lg:grid-cols-2`}>
                  <div className={`flex flex-col ${gridGap}`}>
                    <RiskAnalysis />
                    <AgentStrategyPanel />
                    <StrategyComparison />
                  </div>
                  <div className={`flex flex-col ${gridGap}`}>
                    <DashboardSettings />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ─── QUICK ACTIONS TOOLBAR ─── */}
      <QuickActionsToolbar />

      {/* ─── FOOTER ─── */}
      <footer className="footer-glow-line relative z-10 mt-auto border-t border-[#1e293b]/60 bg-[#0a0e17]/95 px-4 pb-20 pt-2.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between text-[10px] text-[#475569]">
          <div className="flex items-center gap-3">
            <span className="font-mono font-medium text-[#00ff41]/60">
              POLYAGENT v7.2
            </span>
            <span className="hidden sm:inline text-[#1e293b]">·</span>
            <span className="hidden sm:inline">
              35 Components · Toast System · {new Date().getFullYear()}
            </span>
            <span className="hidden lg:inline text-[#1e293b]">·</span>
            <span className="hidden lg:inline">
              Tabbed Nav · Risk & Strategy · Analytics
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-center md:block">
              <Eye className="mr-1 inline-block h-3 w-3 text-[#00ff41]/50" />
              10,000 wallets scanned · 7 edge traders identified ·{' '}
              {totalTrades} trades executed
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              {wsConnected ? (
                <>
                  <Wifi className="h-3 w-3 text-[#00ff41]" />
                  <span className="text-[#00ff41]">WS Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-[#475569]" />
                  <span className="text-[#475569]">OFF</span>
                </>
              )}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
