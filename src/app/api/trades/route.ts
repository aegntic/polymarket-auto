import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const trades = await db.trade.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        wallet: { select: { id: true, address: true, label: true, isEdgeTrader: true } },
        market: { select: { id: true, title: true, slug: true, category: true } },
      },
    })
    return NextResponse.json(trades)
  } catch (error) {
    logger.error('TradesAPI', 'Failed to fetch trades', error)
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { marketId, side, size, price, isAgentTrade, status, txHash } = body

    if (!marketId || !side || !size || !price) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Find or create the market in our DB
    let market = await db.market.findUnique({ where: { id: marketId } })
    if (!market) {
      // Market doesn't exist in our DB yet, create a minimal record
      market = await db.market.create({
        data: {
          id: marketId,
          title: body.marketTitle || `Market ${marketId.slice(0, 8)}`,
          slug: marketId,
          category: body.category || 'unknown',
          yesPrice: price,
          noPrice: 1 - price,
          volume: 0,
          liquidity: 0,
        },
      })
    }

    // Create a system wallet for user trades if needed
    let wallet = await db.wallet.findFirst({ where: { address: 'user-trader' } })
    if (!wallet) {
      wallet = await db.wallet.create({
        data: {
          address: 'user-trader',
          label: 'User Trader',
          totalPnl: 0,
          winRate: 0,
          totalTrades: 0,
          avgPositionSize: 0,
          edgeScore: 0,
          isEdgeTrader: false,
        },
      })
    }

    // Record the trade
    const trade = await db.trade.create({
      data: {
        walletId: wallet.id,
        marketId: market.id,
        side,
        size,
        price,
        isAgentTrade: isAgentTrade ?? false,
        status: status || 'pending',
        agentReasoning: body.reasoning || null,
      },
    })

    // Update wallet stats
    await db.wallet.update({
      where: { id: wallet.id },
      data: {
        totalTrades: { increment: 1 },
        avgPositionSize: size,
        lastActive: new Date(),
      },
    })

    // Update agent state capital
    const agentState = await db.agentState.findFirst({ orderBy: { createdAt: 'desc' } })
    if (agentState) {
      await db.agentState.update({
        where: { id: agentState.id },
        data: {
          currentCapital: { decrement: size },
          totalTrades: { increment: 1 },
        },
      })
    }

    return NextResponse.json({ success: true, trade })
  } catch (error: any) {
    logger.error('TradesAPI', 'Failed to record trade', error)
    return NextResponse.json({ error: 'Failed to record trade', details: error?.message }, { status: 500 })
  }
}
