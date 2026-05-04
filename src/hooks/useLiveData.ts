'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDashboardStore, type Market, type Trade } from '@/lib/store'

// Fetch live market data from our API
async function fetchMarkets(): Promise<Market[]> {
  const res = await fetch('/api/markets?limit=50&active=true')
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

// Fetch edge scores
async function fetchEdgeScores() {
  try {
    const res = await fetch('/api/edge-score?limit=10&minEdge=300')
    if (!res.ok) return []
    const data = await res.json()
    return data.scores || []
  } catch {
    return []
  }
}

// Fetch wallet leaderboard
async function fetchWallets() {
  try {
    const res = await fetch('/api/wallets')
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function useLiveData() {
  const queryClient = useQueryClient()
  const { updateMarket, addLiveTrade, addAgentDecision } = useDashboardStore()
  const initializedRef = useRef(false)

  // Poll markets every 30s
  const marketsQuery = useQuery({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 2,
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

  // Sync market data to store
  useEffect(() => {
    if (marketsQuery.data) {
      for (const market of marketsQuery.data) {
        updateMarket(market)
      }
    }
  }, [marketsQuery.data, updateMarket])

  // Sync edge scores as agent decisions
  useEffect(() => {
    if (!edgeScoresQuery.data || edgeScoresQuery.data.length === 0) return

    for (const score of edgeScoresQuery.data) {
      if (score.recommendation === 'SKIP' || score.recommendation === 'HOLD') continue

      addAgentDecision({
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
      })
    }
  }, [edgeScoresQuery.data, addAgentDecision])

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
