import { NextResponse } from 'next/server'
import { scoreTopMarkets, type MarketEdgeScore } from '@/lib/edge-scorer'
import { runRiskChecks, DEFAULT_RISK_CONFIG } from '@/lib/risk-guardian'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const minEdge = parseInt(searchParams.get('minEdge') || '500')
    const withRisk = searchParams.get('risk') === 'true'

    const scores = await scoreTopMarkets(limit)

    // Filter by minimum edge
    const filtered = scores.filter(s => Math.abs(s.edgeBps) >= minEdge)

    // Optionally run risk checks on each opportunity
    let enriched: any[] = filtered
    if (withRisk) {
      enriched = await Promise.all(
        filtered.map(async (score) => {
          const risk = await runRiskChecks(score, 25, DEFAULT_RISK_CONFIG)
          return { ...score, risk }
        })
      )
    }

    // Summary stats
    const avgEdge = enriched.length > 0
      ? Math.round(enriched.reduce((s, e) => s + Math.abs(e.edgeBps), 0) / enriched.length)
      : 0
    const actionable = enriched.filter(e => e.recommendation === 'STRONG_BUY' || e.recommendation === 'BUY')
    const withRiskApproved = withRisk ? enriched.filter((e: any) => e.risk?.allowed) : null

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      scoredMarkets: scores.length,
      opportunitiesAboveThreshold: enriched.length,
      avgEdgeBps: avgEdge,
      actionableCount: actionable.length,
      ...(withRiskApproved !== null ? { riskApprovedCount: withRiskApproved.length } : {}),
      model: 'grok-4.20',
      config: { minEdgeBps: minEdge, riskChecks: withRisk },
      scores: enriched,
    })
  } catch (error: any) {
    logger.error('EdgeScoreAPI', 'Error occurred during edge scoring', error)
    return NextResponse.json(
      { error: 'Edge scoring failed', details: error?.message },
      { status: 500 }
    )
  }
}
