import { NextResponse } from 'next/server'
import { fetchTrades, normalizeTrade } from '@/lib/polymarket-api'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('marketId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const agentOnly = searchParams.get('agent') === 'true'

    if (!marketId) {
      return NextResponse.json(
        { error: 'marketId parameter is required' },
        { status: 400 }
      )
    }

    const trades = await fetchTrades(marketId, { limit })
    
    // Normalize to our internal format
    const normalized = trades.map((t) => normalizeTrade(t))
    
    // Filter for agent trades if requested
    const filtered = agentOnly
      ? normalized.filter((t) => t.isAgentTrade)
      : normalized

    return NextResponse.json(filtered)
  } catch (error) {
    logger.error('TradesAPI', 'Failed to fetch trades from Polymarket', error)
    return NextResponse.json(
      { error: 'Failed to fetch trades from Polymarket API' },
      { status: 500 }
    )
  }
}
