'use client'

import { create } from 'zustand'

export interface Wallet {
  id: string
  address: string
  label: string | null
  totalPnl: number
  winRate: number
  totalTrades: number
  avgPositionSize: number
  edgeScore: number
  isEdgeTrader: boolean
  firstSeen: string
  lastActive: string
  tradeCount: number
}

export interface Market {
  id: string
  title: string
  slug: string
  category: string
  yesPrice: number
  noPrice: number
  volume: number
  liquidity: number
  mispricingScore: number | null
  endDate: string | null
  isActive: boolean
  tradeCount: number
}

export interface Trade {
  id: string
  walletId: string
  marketId: string
  side: string
  size: number
  price: number
  kellySize: number | null
  pnl: number | null
  isAgentTrade: boolean
  agentReasoning: string | null
  status: string
  createdAt: string
  wallet?: {
    id: string
    address: string
    label: string | null
    isEdgeTrader: boolean
  }
  market?: {
    id: string
    title: string
    slug: string
    category: string
  }
}

export interface AgentDecision {
  id: string
  type: string
  reasoning: string
  confidence: number
  marketId: string | null
  action: string | null
  size: number | null
  kellyFraction: number | null
  outcome: string | null
  pnl: number | null
  createdAt: string
}

export interface AgentState {
  id: string
  status: string
  currentStrategy: string | null
  totalPnl: number
  totalTrades: number
  winRate: number
  sharpeRatio: number | null
  maxDrawdown: number | null
  startedAt: string | null
  lastDecisionAt: string | null
  capitalBase: number
  currentCapital: number
  createdAt: string
  updatedAt: string
}

export interface NewsEvent {
  id: string
  title: string
  source: string
  category: string
  sentiment: number
  impactScore: number
  relatedMarketIds: string | null
  processedByAgent: boolean
  agentAction: string | null
  publishedAt: string
  createdAt: string
}

export interface PerformancePoint {
  timestamp: string
  capital: number
  trades: number
  drawdown: number
}

export interface Toast {
  id: string
  type: 'success' | 'warning' | 'error' | 'info' | 'system'
  title: string
  description?: string
  duration?: number
  timestamp: number
}

interface DashboardStore {
  // Wallet connection
  walletAddress: string | null
  walletBalance: number | null

  // Real-time events
  liveTrades: Trade[]
  agentDecisions: AgentDecision[]
  marketUpdates: Market[]
  newsAlerts: NewsEvent[]

  // Connection state
  wsConnected: boolean
  liveCapital: number | null
  simulationActive: boolean

  // Toast notifications
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id' | 'timestamp'>) => void
  removeToast: (id: string) => void
  clearAllToasts: () => void

  // Actions
  addLiveTrade: (trade: Trade) => void
  setLiveTrades: (trades: Trade[]) => void
  addAgentDecision: (decision: AgentDecision) => void
  setAgentDecisions: (decisions: AgentDecision[]) => void
  updateMarket: (market: Market) => void
  batchUpdateMarkets: (markets: Market[]) => void
  addNewsAlert: (news: NewsEvent) => void
  setWsConnected: (connected: boolean) => void
  setSimulationActive: (active: boolean) => void
  setWalletConnection: (address: string | null, balance?: number) => void
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  // Wallet connection
  walletAddress: null,
  walletBalance: null,

  liveTrades: [],
  agentDecisions: [],
  marketUpdates: [],
  newsAlerts: [],
  wsConnected: false,
  liveCapital: null,
  simulationActive: false,
  toasts: [],

  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          ...toast,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: Date.now(),
        },
      ].slice(-5),
    })),

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearAllToasts: () => set({ toasts: [] }),

  addLiveTrade: (trade) =>
    set((state) => ({
      liveTrades: [trade, ...state.liveTrades].slice(0, 100),
    })),

  setLiveTrades: (trades) =>
    set({ liveTrades: trades.slice(0, 100) }),

  addAgentDecision: (decision) =>
    set((state) => ({
      agentDecisions: [decision, ...state.agentDecisions].slice(0, 50),
    })),

  setAgentDecisions: (decisions) =>
    set({ agentDecisions: decisions.slice(0, 50) }),

  updateMarket: (market) =>
    set((state) => {
      const exists = state.marketUpdates.findIndex((m) => m.id === market.id)
      if (exists >= 0) {
        const updated = [...state.marketUpdates]
        updated[exists] = market
        return { marketUpdates: updated }
      }
      return { marketUpdates: [market, ...state.marketUpdates].slice(0, 50) }
    }),

  batchUpdateMarkets: (markets) =>
    set((state) => {
      const current = [...state.marketUpdates]
      for (const m of markets) {
        const idx = current.findIndex((curr) => curr.id === m.id)
        if (idx >= 0) {
          current[idx] = m
        } else {
          current.unshift(m)
        }
      }
      return { marketUpdates: current.slice(0, 50) }
    }),

  addNewsAlert: (news) =>
    set((state) => ({
      newsAlerts: [news, ...state.newsAlerts].slice(0, 50),
    })),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  setSimulationActive: (active) => set({ simulationActive: active }),

  setWalletConnection: (address, balance?) =>
    set((state) => ({
      walletAddress: address,
      walletBalance: balance !== undefined ? balance : state.walletBalance,
    })),
}))
