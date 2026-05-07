'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDashboardStore, type Market, type Trade } from '@/lib/store'

// Fetch live market data from our API
async function fetchMarkets(): Promise<Market[]> {
  try {
    const res = await fetch('/api/markets?limit=50&active=true')
    if (!res.ok) {
      console.error('[useLiveData] Markets fetch failed:', res.status, res.statusText)
      return []
    }
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.error('[useLiveData] Markets fetch error:', err)
    return []
  }
}

// Fetch edge scores
async function fetchEdgeScores() {
  try {
    const res = await fetch('/api/edge-score?limit=10&minEdge=300')
    if (!res.ok) {
      console.error('[useLiveData] Edge scores fetch failed:', res.status, res.statusText)
      return []
    }
    const data = await res.json()
    return data.scores || []
  } catch (err) {
    console.error('[useLiveData] Edge scores fetch error:', err)
    return []
  }
}

// Fetch wallet leaderboard
async function fetchWallets() {
  try {
    const res = await fetch('/api/wallets')
    if (!res.ok) {
      console.error('[useLiveData] Wallets fetch failed:', res.status, res.statusText)
      return []
    }
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.error('[useLiveData] Wallets fetch error:', err)
    return []
  }
}

// Fetch recent trades
async function fetchRecentTrades(): Promise<Trade[]> {
  try {
    const res = await fetch('/api/trades?limit=50')
    if (!res.ok) {
      console.error('[useLiveData] Trades fetch failed:', res.status, res.statusText)
      return []
    }
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch (err) {
    console.error('[useLiveData] Trades fetch error:', err)
    return []
  }
}

export function useLiveData() {
  const queryClient = useQueryClient()
  const { batchUpdateMarkets, setAgentDecisions, setLiveTrades } = useDashboardStore()
  const initializedRef = useRef(false)

  // Poll markets every 30s
  const marketsQuery = useQuery({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 2,
  })

  // Poll trades every 20s
  const tradesQuery = useQuery({
    queryKey: ['recent-trades'],
    queryFn: fetchRecentTrades,
    refetchInterval: 20_000,
    staleTime: 10_000,
    retry: 1,
  })

  // Poll edge scores every 90s
  const edgeScoresQuery = useQuery({
    queryKey: ['edge-scores'],
    queryFn: fetchEdgeScores,
    refetchInterval: 90_000,
    staleTime: 60_000,
    retry: 1,
  })

  // Poll wallets every 60s
  const walletsQuery = useQuery({
    queryKey: ['wallets'],
    queryFn: fetchWallets,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  })

  // Sync market data to store (batched)
  useEffect(() => {
    if (marketsQuery.data && marketsQuery.data.length > 0) {
      batchUpdateMarkets(marketsQuery.data)
    }
  }, [marketsQuery.data, batchUpdateMarkets])

  // Sync trades to store (batched)
  useEffect(() => {
    if (tradesQuery.data && tradesQuery.data.length > 0) {
      setLiveTrades(tradesQuery.data)
    }
  }, [tradesQuery.data, setLiveTrades])

  // Sync edge scores as agent decisions (batched)
  useEffect(() => {
    if (!edgeScoresQuery.data || edgeScoresQuery.data.length === 0) return

    const decisions = edgeScoresQuery.data
      .filter((score: any) => score.recommendation !== 'SKIP' && score.recommendation !== 'HOLD')
      .map((score: any) => ({
        id: `edge-${score.marketId}`,
        type: 'analyze',
        reasoning: score.reasoning,
        confidence: score.confidence / 100,
        marketId: score.marketId,
        action: score.recommendation === 'STRONG_BUY' || score.recommendation === 'BUY'
          ? 'BUY YES' : 'HOLD',
        size: score.suggestedSizeUSD,
        kellyFraction: score.kellyFraction,
        outcome: null,
        pnl: null,
        createdAt: score.scoredAt,
      }))

    setAgentDecisions(decisions)
  }, [edgeScoresQuery.data, setAgentDecisions])

  return {
    markets: marketsQuery.data ?? [],
    edgeScores: edgeScoresQuery.data ?? [],
    wallets: walletsQuery.data ?? [],
    isLoading: marketsQuery.isLoading,
    isError: marketsQuery.isError,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      queryClient.invalidateQueries({ queryKey: ['edge-scores'] })
      queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
  }
}
