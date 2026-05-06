// Multi-signal edge scoring engine
// Fuses price momentum, volume, wallet activity, and Grok analysis
// into a single edge score per market. No duplication — uses existing
// polymarket-api.ts for data and Grok for reasoning.

import { fetchMarkets, normalizeMarket, type PolymarketMarket } from '@/lib/polymarket-api'
import { db } from '@/lib/db'
import { logger } from './logger'

const XAI_API_KEY = process.env.XAI_API_KEY

// --- Types ---

export interface SignalSet {
  priceMomentum: number    // -1 to 1 (recent price direction strength)
  volumeSurge: number       // 0 to 1 (how current volume compares to baseline)
  walletConviction: number  // 0 to 1 (edge trader activity on this market)
  liquidityDepth: number    // 0 to 1 (how much liquidity supports entry/exit)
}

export interface MarketEdgeScore {
  marketId: string
  question: string
  slug: string
  category: string
  currentYesPrice: number
  grokTrueProbability: number
  edgeBps: number            // basis points vs implied probability
  confidence: number         // 0-100
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SKIP'
  reasoning: string
  signals: SignalSet
  kellyFraction: number | null
  suggestedSizeUSD: number | null
  scoredAt: string
}

// --- Signal Calculators ---

function calcPriceMomentum(prices: string[]): number {
  // If we have outcome prices, derive directional bias
  const yesPrice = parseFloat(prices?.[0] || '0.5')
  // Distance from 0.5 indicates market conviction; extremes = stronger signal
  return (yesPrice - 0.5) * 2 // -1 to 1
}

function calcVolumeSurge(volume: number): number {
  // Normalize volume on a sigmoid — high volume = stronger signal confidence
  if (volume <= 0) return 0
  const k = 50000 // midpoint
  return 1 / (1 + Math.exp(-(volume - k) / k))
}

async function calcWalletConviction(marketId: string): Promise<number> {
  // Check if any tracked edge traders have positions on this market
  try {
    const edgeTraders = await db.wallet.findMany({
      where: { isEdgeTrader: true },
      include: { trades: { where: { marketId }, take: 5, orderBy: { createdAt: 'desc' } } },
    })
    const totalTrades = edgeTraders.reduce((sum, w) => sum + w.trades.length, 0)
    if (totalTrades === 0) return 0.3 // neutral default
    const avgEdge = edgeTraders.filter(w => w.trades.length > 0)
      .reduce((sum, w) => sum + w.edgeScore, 0) / Math.max(edgeTraders.filter(w => w.trades.length > 0).length, 1)
    return Math.min(avgEdge / 10, 1) // normalize edgeScore (typically 0-10) to 0-1
  } catch {
    return 0.3 // fallback if DB unavailable
  }
}

function calcLiquidityDepth(liquidity: number): number {
  if (liquidity <= 0) return 0
  const k = 25000
  return 1 / (1 + Math.exp(-(liquidity - k) / k))
}

// --- Grok Analysis ---

async function analyzeWithGrok(market: PolymarketMarket, signals: SignalSet): Promise<{
  trueProbability: number
  confidence: number
  reasoning: string
}> {
  if (!XAI_API_KEY) {
    return { trueProbability: 0.5, confidence: 40, reasoning: 'No XAI_API_KEY configured' }
  }

  const yesPrice = parseFloat(market.outcomePrices?.[0] || '0.5') || 0.5

  const prompt = `You are a Polymarket edge analyst. Score this market.

Market: ${market.question}
Category: ${market.tags?.[0] || 'unknown'}
Volume: $${Math.round(market.volume || 0).toLocaleString()}
Liquidity: $${Math.round(market.liquidity || 0).toLocaleString()}
Current YES price: ${yesPrice.toFixed(3)}

Quantitative signals (0-1 scale):
- Price momentum: ${signals.priceMomentum.toFixed(3)}
- Volume surge: ${signals.volumeSurge.toFixed(3)}
- Wallet conviction: ${signals.walletConviction.toFixed(3)}
- Liquidity depth: ${signals.liquidityDepth.toFixed(3)}

Tasks:
1. Estimate the TRUE probability of YES resolving (independent of market price)
2. Rate your confidence in this estimate (0-100)
3. Brief reasoning (2-3 sentences max)

Respond in this exact format:
TRUE_PROB: 0.XX
CONFIDENCE: XX
REASONING: ...`

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-4.20',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      }),
    })

    if (!res.ok) return { trueProbability: 0.5, confidence: 30, reasoning: `Grok API error: ${res.status}` }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || ''

    const probMatch = text.match(/TRUE_PROB:\s*([0-9.]+)/)
    const confMatch = text.match(/CONFIDENCE:\s*([0-9]+)/)
    const reasonMatch = text.match(/REASONING:\s*(.+)/)

    return {
      trueProbability: probMatch ? Math.max(0, Math.min(1, parseFloat(probMatch[1]))) : 0.5,
      confidence: confMatch ? Math.max(0, Math.min(100, parseInt(confMatch[1]))) : 50,
      reasoning: reasonMatch ? reasonMatch[1].trim() : text.slice(0, 200),
    }
  } catch (err: any) {
    return { trueProbability: 0.5, confidence: 30, reasoning: `Grok call failed: ${err.message}` }
  }
}

// --- Kelly Fraction ---

function calcKelly(trueProb: number, yesPrice: number): number {
  // f* = (bp - q) / b where b = (1/price - 1), p = trueProb, q = 1-p
  if (yesPrice <= 0 || yesPrice >= 1) return 0
  const b = (1 / yesPrice) - 1
  const q = 1 - trueProb
  const kelly = (b * trueProb - q) / b
  return Math.max(0, Math.min(kelly, 1))
}

// --- Recommendation ---

function getRecommendation(edgeBps: number, confidence: number): 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SKIP' {
  if (confidence < 55) return 'SKIP'
  if (Math.abs(edgeBps) < 500) return 'HOLD' // < 5% edge
  if (Math.abs(edgeBps) >= 1200 && confidence >= 75) return 'STRONG_BUY'
  return 'BUY'
}

// --- Main Scoring ---

export async function scoreMarket(market: PolymarketMarket): Promise<MarketEdgeScore> {
  const yesPrice = parseFloat(market.outcomePrices?.[0] || '0.5') || 0.5

  // Build signals
  const signals: SignalSet = {
    priceMomentum: calcPriceMomentum(
      Array.isArray(market.outcomePrices) ? market.outcomePrices : []
    ),
    volumeSurge: calcVolumeSurge(market.volume || 0),
    walletConviction: await calcWalletConviction(market.conditionId),
    liquidityDepth: calcLiquidityDepth(market.liquidity || 0),
  }

  // Grok analysis
  const analysis = await analyzeWithGrok(market, signals)

  // Edge in basis points
  const edgeBps = Math.round((analysis.trueProbability - yesPrice) * 10000)

  // Kelly sizing (quarter-Kelly for safety)
  const fullKelly = calcKelly(analysis.trueProbability, yesPrice)
  const quarterKelly = fullKelly * 0.25

  // Suggested position size (based on $25 starting capital)
  const capitalBase = 25
  const suggestedSize = quarterKelly > 0 ? Math.round(quarterKelly * capitalBase * 100) / 100 : null

  return {
    marketId: market.conditionId,
    question: market.question,
    slug: market.slug,
    category: market.tags?.[0] || 'unknown',
    currentYesPrice: yesPrice,
    grokTrueProbability: analysis.trueProbability,
    edgeBps,
    confidence: analysis.confidence,
    recommendation: edgeBps > 0 ? getRecommendation(edgeBps, analysis.confidence) : 'HOLD',
    reasoning: analysis.reasoning,
    signals,
    kellyFraction: quarterKelly > 0 ? Math.round(quarterKelly * 10000) / 10000 : null,
    suggestedSizeUSD: suggestedSize,
    scoredAt: new Date().toISOString(),
  }
}

// Batch score top markets
export async function scoreTopMarkets(limit = 20): Promise<MarketEdgeScore[]> {
  const rawMarkets = await fetchMarkets({ limit, active: true })
  const validMarkets = rawMarkets.filter((m: PolymarketMarket) => m.active && !m.closed && m.volume > 0)

  // Score markets sequentially to avoid rate limits
  const scores: MarketEdgeScore[] = []
  for (const market of validMarkets) {
    try {
      const score = await scoreMarket(market)
      scores.push(score)
    } catch (err: any) {
      logger.warn('EdgeScorer', `Failed to score ${market.question}: ${err.message}`)
    }
  }

  // Sort by absolute edge descending
  return scores.sort((a, b) => Math.abs(b.edgeBps) - Math.abs(a.edgeBps))
}
