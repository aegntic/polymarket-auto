import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    let agentState = await db.agentState.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    // Create default state if none exists (app structure)
    if (!agentState) {
      agentState = await db.agentState.create({
        data: {
          status: 'active',
          currentStrategy: 'kelly-criterion',
          totalPnl: 0,
          totalTrades: 0,
          winRate: 0,
          sharpeRatio: null,
          maxDrawdown: null,
          capitalBase: 55,
          currentCapital: 55,
        },
      })
    }

    const recentDecisions = await db.agentDecision.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      state: agentState,
      recentDecisions,
    })
  } catch (error) {
    logger.error('AgentAPI', 'Failed to fetch agent data', error)
    return NextResponse.json({ error: 'Failed to fetch agent data' }, { status: 500 })
  }
}
