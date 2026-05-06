'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMarkets, fetchTrades, type PolymarketMarket, type PolymarketTrade } from '@/lib/polymarket-api'

// Fetch live markets from Polymarket
export function usePolymarketMarkets(options?: {
  limit?: number
  active?: boolean
  tag?: string
  enabled?: boolean
}) {
  return useQuery<PolymarketMarket[]>({
    queryKey: ['polymarket-markets', options?.limit, options?.active, options?.tag],
    queryFn: () => fetchMarkets(options),
    refetchInterval: 60000, // Refetch every 60 seconds
    staleTime: 30000, // Consider data fresh for 30 seconds
    enabled: options?.enabled !== false,
  })
}

// Fetch trades for a specific market
export function usePolymarketTrades(marketId: string, options?: {
  limit?: number
  enabled?: boolean
}) {
  return useQuery<PolymarketTrade[]>({
    queryKey: ['polymarket-trades', marketId, options?.limit],
    queryFn: () => fetchTrades(marketId, { limit: options?.limit }),
    refetchInterval: 15000, // Refetch every 15 seconds
    staleTime: 10000, // Consider data fresh for 10 seconds
    enabled: !!marketId && options?.enabled !== false,
  })
}

// Hook to prefetch markets (for performance)
export function usePrefetchMarkets() {
  const queryClient = useQueryClient()
  
  return (options?: { limit?: number; active?: boolean }) => {
    queryClient.prefetchQuery({
      queryKey: ['polymarket-markets', options?.limit, options?.active],
      queryFn: () => fetchMarkets(options),
      staleTime: 30000,
    })
  }
}
