import { NextResponse } from 'next/server'
import { fetchMarkets, normalizeMarket } from '@/lib/polymarket-api'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const active = searchParams.get('active') !== 'false'
    const tag = searchParams.get('tag') || undefined

    let markets
    try {
      markets = await fetchMarkets({ limit, active, tag })
      if (!Array.isArray(markets) || markets.length === 0) {
        throw new Error('No data from API')
      }
    } catch (apiError: any) {
      logger.warn('MarketsAPI', `Returning empty array (API blocked or failed): ${apiError?.message}`)
      markets = []
    }

    // Normalize to our internal format
    const normalized = markets.map(normalizeMarket)

    // Sort by mispricing score (nulls last)
    const sorted = normalized.sort((a, b) => {
      if (a.mispricingScore === null && b.mispricingScore === null) return 0
      if (a.mispricingScore === null) return 1
      if (b.mispricingScore === null) return -1
      return b.mispricingScore - a.mispricingScore
    })

    return NextResponse.json(sorted)
  } catch (error) {
    logger.error('MarketsAPI', 'Failed to fetch markets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch markets' },
      { status: 500 }
    )
  }
}
}
