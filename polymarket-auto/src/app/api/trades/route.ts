import { NextResponse } from 'next/server'
import { fetchTrades, normalizeTrade } from '@/lib/polymarket-api'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const agentOnly = searchParams.get('agent') === 'true'

    let trades: any[] = []

    if (marketId) {
      // Fetch from Polymarket API for specific market
      const pmTrades = await fetchTrades(marketId, { limit })
      trades = pmTrades.map((t) => normalizeTrade(t))
    } else {
      // Fetch most recent trades from our own database (global feed)
      const dbTrades = await db.trade.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: true,
          market: true,
        },
      })
      
      trades = dbTrades.map((t) => ({
        id: t.id,
        walletId: t.walletId,
        marketId: t.marketId,
        side: t.side,
        size: t.size,
        price: t.price,
        kellySize: t.kellySize,
        pnl: t.pnl,
        isAgentTrade: t.isAgentTrade,
        agentReasoning: t.agentReasoning,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        wallet: t.wallet ? {
          id: t.wallet.id,
          address: t.wallet.address,
          label: t.wallet.label,
          isEdgeTrader: t.wallet.isEdgeTrader,
        } : undefined,
        market: t.market ? {
          id: t.market.id,
          title: t.market.title,
          slug: t.market.slug,
          category: t.market.category,
        } : undefined,
      }))
    }
    
    // Filter for agent trades if requested
    const filtered = agentOnly
      ? trades.filter((t) => t.isAgentTrade)
      : trades

    return NextResponse.json(filtered)
  } catch (error) {
    logger.error('TradesAPI', 'Failed to fetch trades', error)
    return NextResponse.json(
      { error: 'Failed to fetch trades' },
      { status: 500 }
    )
  }
}
