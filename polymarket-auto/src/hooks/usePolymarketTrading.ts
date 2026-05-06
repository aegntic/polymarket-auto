'use client'

import { useCallback } from 'react'
import { useWalletClient, usePublicClient } from 'wagmi'
import { type TradeParams, type TradeResult, buyYes, buyNo, checkAllowance, approveUSDC, parseUSDC } from '@/lib/trading-service'
import { useDashboardStore } from '@/lib/store'

// Hook for executing real trades on Polymarket
export function usePolymarketTrading() {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const addToast = useDashboardStore((s) => s.addToast)
  const addLiveTrade = useDashboardStore((s) => s.addLiveTrade)

  // Check if wallet is connected
  const isReady = !!walletClient && !!publicClient

  // Buy YES tokens
  const executeBuyYes = useCallback(async (
    marketId: string,
    price: number,
    size: number
  ): Promise<TradeResult> => {
    if (!walletClient || !publicClient) {
      return { success: false, error: 'Wallet not connected' }
    }

    try {
      // Check allowance first
      const allowance = await checkAllowance(publicClient, walletClient)
      const requiredAmount = parseUSDC(size)
      
      if (allowance < requiredAmount) {
        addToast({
          type: 'info',
          title: 'Approving USDC',
          description: `Approving ${size} USDC for trading...`,
        })
        
        // Approve USDC spending
        const approveHash = await approveUSDC(publicClient, walletClient, requiredAmount)
        addToast({
          type: 'success',
          title: 'USDC Approved',
          description: `Transaction: ${approveHash}`,
        })
      }

      // Execute trade
      addToast({
        type: 'info',
        title: 'Placing Order',
        description: `Buying YES at $${price} for $${size}`,
      })

      const result = await buyYes(publicClient, walletClient, marketId, price, size)

      if (result.success) {
        addToast({
          type: 'success',
          title: 'Trade Executed',
          description: `YES order placed. Hash: ${result.transactionHash?.slice(0, 10)}...`,
        })

        // Add to live trades feed
        addLiveTrade({
          id: `trade-${Date.now()}`,
          walletId: walletClient.account!.address,
          marketId,
          side: 'YES',
          size,
          price,
          kellySize: null,
          pnl: null,
          isAgentTrade: false,
          agentReasoning: null,
          status: 'pending', // Will update to 'filled' when confirmed
          createdAt: new Date().toISOString(),
          wallet: {
            id: walletClient.account!.address,
            address: walletClient.account!.address,
            label: 'You',
            isEdgeTrader: false,
          },
          market: {
            id: marketId,
            title: 'Unknown Market',
            slug: '',
            category: 'crypto',
          },
        })
      } else {
        addToast({
          type: 'error',
          title: 'Trade Failed',
          description: result.error || 'Unknown error',
        })
      }

      return result
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error'
      addToast({
        type: 'error',
        title: 'Trade Failed',
        description: errorMsg,
      })
      return { success: false, error: errorMsg }
    }
  }, [walletClient, publicClient, addToast, addLiveTrade])

  // Buy NO tokens
  const executeBuyNo = useCallback(async (
    marketId: string,
    price: number,
    size: number
  ): Promise<TradeResult> => {
    if (!walletClient || !publicClient) {
      return { success: false, error: 'Wallet not connected' }
    }

    try {
      // Check allowance first
      const allowance = await checkAllowance(publicClient, walletClient)
      const requiredAmount = parseUSDC(size)
      
      if (allowance < requiredAmount) {
        addToast({
          type: 'info',
          title: 'Approving USDC',
          description: `Approving ${size} USDC for trading...`,
        })
        
        const approveHash = await approveUSDC(publicClient, walletClient, requiredAmount)
        addToast({
          type: 'success',
          title: 'USDC Approved',
          description: `Transaction: ${approveHash}`,
        })
      }

      addToast({
        type: 'info',
        title: 'Placing Order',
        description: `Buying NO at $${price} for $${size}`,
      })

      const result = await buyNo(publicClient, walletClient, marketId, price, size)

      if (result.success) {
        addToast({
          type: 'success',
          title: 'Trade Executed',
          description: `NO order placed. Hash: ${result.transactionHash?.slice(0, 10)}...`,
        })

        addLiveTrade({
          id: `trade-${Date.now()}`,
          walletId: walletClient.account!.address,
          marketId,
          side: 'NO',
          size,
          price,
          kellySize: null,
          pnl: null,
          isAgentTrade: false,
          agentReasoning: null,
          status: 'pending',
          createdAt: new Date().toISOString(),
          wallet: {
            id: walletClient.account!.address,
            address: walletClient.account!.address,
            label: 'You',
            isEdgeTrader: false,
          },
          market: {
            id: marketId,
            title: 'Unknown Market',
            slug: '',
            category: 'crypto',
          },
        })
      } else {
        addToast({
          type: 'error',
          title: 'Trade Failed',
          description: result.error || 'Unknown error',
        })
      }

      return result
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error'
      addToast({
        type: 'error',
        title: 'Trade Failed',
        description: errorMsg,
      })
      return { success: false, error: errorMsg }
    }
  }, [walletClient, publicClient, addToast, addLiveTrade])

  return {
    isReady,
    buyYes: executeBuyYes,
    buyNo: executeBuyNo,
  }
}
