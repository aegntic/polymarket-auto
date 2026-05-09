'use client'

import { useEffect, useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { useLiveData } from '@/hooks/useLiveData'
import { useAccount, useBalance } from 'wagmi'
import { useDashboardStore, type AgentState } from '@/lib/store'
import { WalletMenu } from '@/components/dashboard/WalletMenu'
import { ToastNotificationSystem } from '@/components/dashboard/ToastNotificationSystem'
import { GettingStarted } from '@/components/dashboard/GettingStarted'
import { useDashboardSettings } from '@/hooks/useDashboardSettings'
import { motion, AnimatePresence } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
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
  Layers,
  Gem,
  LayoutDashboard,
  ArrowLeftRight,
  Network,
  Search,
} from 'lucide-react'

// Dynamic Imports with loading states
const PerformanceChart = dynamic(() => import('@/components/dashboard/PerformanceChart').then(mod => mod.PerformanceChart), { ssr: false, loading: () => <Skeleton className="h-[260px] w-full bg-[#1e293b]/50" /> })
const PortfolioTimeline = dynamic(() => import('@/components/dashboard/PortfolioTimeline').then(mod => mod.PortfolioTimeline), { ssr: false, loading: () => <Skeleton className="h-[260px] w-full bg-[#1e293b]/50" /> })
const WalletLeaderboard = dynamic(() => import('@/components/dashboard/WalletLeaderboard').then(mod => mod.WalletLeaderboard), { ssr: false })
const NewsFeed = dynamic(() => import('@/components/dashboard/NewsFeed').then(mod => mod.NewsFeed), { ssr: false })
const AgentConsole = dynamic(() => import('@/components/dashboard/AgentConsole').then(mod => mod.AgentConsole), { ssr: false })
const TradeFeed = dynamic(() => import('@/components/dashboard/TradeFeed').then(mod => mod.TradeFeed), { ssr: false })
const WalletNetworkGraph = dynamic(() => import('@/components/dashboard/WalletNetworkGraph').then(mod => mod.WalletNetworkGraph), { ssr: false })
const WalletActivityHeatmap = dynamic(() => import('@/components/dashboard/WalletActivityHeatmap').then(mod => mod.WalletActivityHeatmap), { ssr: false })
const PnLHeatmap = dynamic(() => import('@/components/dashboard/PnLHeatmap').then(mod => mod.PnLHeatmap), { ssr: false })
const SentimentTimeline = dynamic(() => import('@/components/dashboard/SentimentTimeline').then(mod => mod.SentimentTimeline), { ssr: false })
const WalletComparisonTool = dynamic(() => import('@/components/dashboard/WalletComparisonTool').then(mod => mod.WalletComparisonTool), { ssr: false })
const MarketSentimentGauge = dynamic(() => import('@/components/dashboard/MarketSentimentGauge').then(mod => mod.MarketSentimentGauge), { ssr: false })
const CorrelationMatrix = dynamic(() => import('@/components/dashboard/CorrelationMatrix').then(mod => mod.CorrelationMatrix), { ssr: false })
const TradeClustering = dynamic(() => import('@/components/dashboard/TradeClustering').then(mod => mod.TradeClustering), { ssr: false })
const PerformanceAttribution = dynamic(() => import('@/components/dashboard/PerformanceAttribution').then(mod => mod.PerformanceAttribution), { ssr: false })
const AgentPerformanceTimeline = dynamic(() => import('@/components/dashboard/AgentPerformanceTimeline').then(mod => mod.AgentPerformanceTimeline), { ssr: false })
const WalletConnectPanel = dynamic(() => import('@/components/dashboard/WalletConnectPanel').then(mod => mod.WalletConnectPanel), { ssr: false })
const MarketScanner = dynamic(() => import('@/components/dashboard/MarketScanner').then(mod => mod.MarketScanner), { ssr: false })
const MarketDepth = dynamic(() => import('@/components/dashboard/MarketDepth').then(mod => mod.MarketDepth), { ssr: false })
const KellySizer = dynamic(() => import('@/components/dashboard/KellySizer').then(mod => mod.KellySizer), { ssr: false })
const OrderBookDepth = dynamic(() => import('@/components/dashboard/OrderBookDepth').then(mod => mod.OrderBookDepth), { ssr: false })
const StrategyBacktest = dynamic(() => import('@/components/dashboard/StrategyBacktest').then(mod => mod.StrategyBacktest), { ssr: false })
const PortfolioAllocation = dynamic(() => import('@/components/dashboard/PortfolioAllocation').then(mod => mod.PortfolioAllocation), { ssr: false })
const TradeExport = dynamic(() => import('@/components/dashboard/TradeExport').then(mod => mod.TradeExport), { ssr: false })
const TradeHistoryLog = dynamic(() => import('@/components/dashboard/TradeHistoryLog').then(mod => mod.TradeHistoryLog), { ssr: false })
const DeploymentTimeline = dynamic(() => import('@/components/dashboard/DeploymentTimeline').then(mod => mod.DeploymentTimeline), { ssr: false })
const RiskAnalysis = dynamic(() => import('@/components/dashboard/RiskAnalysis').then(mod => mod.RiskAnalysis), { ssr: false })
const AgentStrategyPanel = dynamic(() => import('@/components/dashboard/AgentStrategyPanel').then(mod => mod.AgentStrategyPanel), { ssr: false })
const StrategyComparison = dynamic(() => import('@/components/dashboard/StrategyComparison').then(mod => mod.StrategyComparison), { ssr: false })
const DashboardSettings = dynamic(() => import('@/components/dashboard/DashboardSettings').then(mod => mod.DashboardSettings), { ssr: false })
const QuickActionsToolbar = dynamic(() => import('@/components/dashboard/QuickActionsToolbar').then(mod => mod.QuickActionsToolbar), { ssr: false })
const AlertCenter = dynamic(() => import('@/components/dashboard/AlertCenter').then(mod => mod.AlertCenter), { ssr: false })
const LivePriceTicker = dynamic(() => import('@/components/dashboard/LivePriceTicker').then(mod => mod.LivePriceTicker), { ssr: false })

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
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return (
    <span className={`font-mono ${className}`}>
      {prefix}{formatted}{suffix}
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
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  // Memoized selectors to prevent whole-page re-renders
  const walletAddress = useDashboardStore((s) => s.walletAddress)
  const walletBalance = useDashboardStore((s) => s.walletBalance)
  const liveCapital = useDashboardStore((s) => s.liveCapital)
  const setWalletConnection = useDashboardStore((s) => s.setWalletConnection)
  const wsConnected = useDashboardStore((s) => s.wsConnected)

  // Save tab to localStorage
  useEffect(() => {
    localStorage.setItem('polyagent-active-tab', activeTab)
  }, [activeTab])

  const liveData = useLiveData()
  const { settings } = useDashboardSettings()
  
  const gridGap = settings.compactMode ? 'gap-3' : 'gap-5'
  const sectionMb = settings.compactMode ? 'mb-3' : 'mb-5'

  const { data: agentData } = useQuery<{
    state: AgentState
    recentDecisions: unknown[]
  }>({
    queryKey: ['agent'],
    queryFn: () => fetch('/api/agent').then((r) => r.json()),
    refetchInterval: 15000,
  })

  const agent = agentData?.state

  // Sync wagmi wallet state (Native USDC)
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount()
  const { data: usdcBalance } = useBalance({
    address: wagmiAddress,
    contract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`,
    chainId: 137,
  })

  useEffect(() => {
    if (wagmiConnected && wagmiAddress) {
      // Always sync address. Use balance if available, otherwise just sync address.
      const bal = usdcBalance ? parseFloat(usdcBalance.value.toString()) / Math.pow(10, usdcBalance.decimals) : 0
      setWalletConnection(wagmiAddress, bal)
    } else if (!wagmiConnected && walletAddress) {
      setWalletConnection(null)
    }
  }, [wagmiConnected, wagmiAddress, usdcBalance, setWalletConnection, walletAddress])

  // REAL CAPITAL PRIORITY: Wallet > API > Simulation
  const currentCapital = walletAddress 
    ? (walletBalance ?? liveCapital ?? agent?.currentCapital ?? 0)
    : (agent?.currentCapital ?? 0)
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
      className="flex min-h-screen flex-col bg-[#0a0e17] text-[#e2e8f0]"
      style={{ '--anim-speed': settings.animationSpeed } as React.CSSProperties}
      data-card-style={settings.cardStyle}
    >
      <ToastNotificationSystem />

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-[#1e293b]/60 bg-[#0a0e17]/90 px-4 py-2.5 backdrop-blur-xl [--header-h:80px]">

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
              color="#64748b"
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
                  <span className="text-sm font-bold text-[#64748b]">
                    --
                  </span>
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

          {/* Right side: Alerts + Wallet Menu */}
          <div className="relative flex items-center gap-2">
            <AlertCenter />
            <WalletMenu />
          </div>
        </div>

        {/* System Status Row */}
        <div className="mx-auto mt-1.5 flex max-w-[1800px] items-center justify-between gap-4 border-t border-[#1e293b]/30 pt-1.5">
          <div className="flex items-center gap-1.5 text-[9px] text-[#64748b]">
            <Clock className="h-3 w-3 text-cyan-400" />
            <span>Elapsed:</span>
            <ElapsedCounter startTime={agent?.startedAt ?? null} />
          </div>
          <div className="hidden xl:block">
            <SystemStatus />
          </div>
        </div>
      </header>

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
                      : 'text-[#64748b] hover:text-[#94a3b8] border-b-2 border-transparent'
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
          {/* Getting Started modal - blocks dashboard until dismissed */}
          <GettingStarted onDismiss={() => {}} />
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
                {/* PortfolioTimeline - full width */}
                <div className={sectionMb}>
                  <PortfolioTimeline />
                </div>
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
      <footer className="relative z-10 mt-auto border-t border-[#1e293b]/60 bg-[#0a0e17]/95 px-4 pb-20 pt-2.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between text-[10px] text-[#64748b]">
          <div className="flex items-center gap-3">
            <span className="font-mono font-medium text-[#00ff41]/60">
              POLYAGENT v8.3
            </span>
            <span className="hidden sm:inline text-[#1e293b]">·</span>
            <span className="hidden sm:inline">
              Autonomous Polymarket Trading · {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono">
              {wsConnected ? (
                <>
                  <Wifi className="h-3 w-3 text-[#00ff41]" />
                  <span className="text-[#00ff41]">LIVE</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-[#64748b]" />
                  <span className="text-[#64748b]">OFFLINE</span>
                </>
              )}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
