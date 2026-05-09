import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    // Get the latest agent state
    const agentState = await db.agentState.findFirst({
      orderBy: { updatedAt: 'desc' },
    })

    // Get all trades ordered by time
    const trades = await db.trade.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        pnl: true,
        createdAt: true,
        size: true,
      },
    })

    const capitalBase = agentState?.capitalBase ?? 0
    const currentCapital = agentState?.currentCapital ?? capitalBase

    // Build a time series from actual trade PnL
    // If no trades, return a single point at capitalBase
    if (trades.length === 0) {
      return NextResponse.json({
        series: capitalBase > 0 ? [{
          timestamp: new Date().toISOString(),
          capital: capitalBase,
          trades: 0,
          drawdown: 0,
        }] : [],
        summary: {
          currentCapital,
          capitalBase,
          totalPnl: agentState?.totalPnl ?? 0,
          totalTrades: 0,
          winRate: agentState?.winRate ?? 0,
          sharpeRatio: agentState?.sharpeRatio ?? null,
          maxDrawdown: agentState?.maxDrawdown ?? null,
        },
      })
    }

    // Build cumulative capital curve from trade PnL
    let runningCapital = capitalBase
    let peak = capitalBase
    let maxDrawdown = 0
    const points: Array<{ timestamp: string; capital: number; trades: number; drawdown: number }> = []

    // Always start at capitalBase
    if (trades.length > 0) {
      points.push({
        timestamp: trades[0].createdAt.toISOString(),
        capital: capitalBase,
        trades: 0,
        drawdown: 0,
      })
    }

    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i]
      const pnl = trade.pnl ?? 0
      runningCapital += pnl

      if (runningCapital > peak) peak = runningCapital
      const drawdown = peak > 0 ? Math.max(0, (peak - runningCapital) / peak) : 0
      if (drawdown > maxDrawdown) maxDrawdown = drawdown

      points.push({
        timestamp: trade.createdAt.toISOString(),
        capital: parseFloat(runningCapital.toFixed(2)),
        trades: i + 1,
        drawdown: parseFloat(drawdown.toFixed(4)),
      })
    }

    return NextResponse.json({
      series: points,
      summary: {
        currentCapital,
        capitalBase,
        totalPnl: agentState?.totalPnl ?? (currentCapital - capitalBase),
        totalTrades: trades.length,
        winRate: agentState?.winRate ?? 0,
        sharpeRatio: agentState?.sharpeRatio ?? null,
        maxDrawdown: agentState?.maxDrawdown ?? maxDrawdown,
      },
    })
  } catch (error) {
    logger.error('PerformanceAPI', 'Failed to fetch performance data', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    )
  }
}
