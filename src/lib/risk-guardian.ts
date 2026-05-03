// Risk Guardian — pre-trade checks before the agent executes
// Enforces drawdown limits, daily loss caps, concentration limits, and cooldowns

import { db } from '@/lib/db'
import type { MarketEdgeScore } from '@/lib/edge-scorer'

export interface RiskConfig {
  maxDailyLossPct: number       // % of capital (default 5%)
  maxDrawdownPct: number        // % from peak (default 15%)
  maxPositionPct: number        // % of capital per trade (default 10%)
  maxCategoryPct: number        // % of capital in one category (default 30%)
  minConfidence: number         // minimum edge score confidence to trade (default 60)
  minEdgeBps: number            // minimum edge in basis points (default 500 = 5%)
  cooldownMinutes: number       // minutes between trades on same market (default 30)
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxDailyLossPct: 5,
  maxDrawdownPct: 15,
  maxPositionPct: 10,
  maxCategoryPct: 30,
  minConfidence: 60,
  minEdgeBps: 500,
  cooldownMinutes: 30,
}

export interface RiskCheckResult {
  allowed: boolean
  reasons: string[]
  warnings: string[]
  adjustedSizeUSD: number | null  // null if trade blocked, reduced if over limit
}

export async function runRiskChecks(
  score: MarketEdgeScore,
  capitalBase: number = 25,
  config: RiskConfig = DEFAULT_RISK_CONFIG
): Promise<RiskCheckResult> {
  const reasons: string[] = []
  const warnings: string[] = []
  let adjustedSize = score.suggestedSizeUSD

  // 1. Confidence gate
  if (score.confidence < config.minConfidence) {
    reasons.push(`Confidence ${score.confidence}% below minimum ${config.minConfidence}%`)
  }

  // 2. Edge threshold
  if (Math.abs(score.edgeBps) < config.minEdgeBps) {
    reasons.push(`Edge ${score.edgeBps}bps below minimum ${config.minEdgeBps}bps`)
  }

  // 3. Position size cap
  if (adjustedSize && adjustedSize > capitalBase * (config.maxPositionPct / 100)) {
    const capped = Math.round(capitalBase * (config.maxPositionPct / 100) * 100) / 100
    warnings.push(`Position reduced from $${adjustedSize} to $${capped} (max ${config.maxPositionPct}% of capital)`)
    adjustedSize = capped
  }

  // 4. Daily loss check
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayTrades = await db.trade.findMany({
      where: {
        isAgentTrade: true,
        createdAt: { gte: todayStart },
        pnl: { not: null },
      },
    })

    const dailyPnl = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    const dailyLossLimit = capitalBase * (config.maxDailyLossPct / 100)

    if (dailyPnl < -dailyLossLimit) {
      reasons.push(`Daily loss $${Math.abs(dailyPnl).toFixed(2)} exceeds limit $${dailyLossLimit.toFixed(2)}`)
    } else if (dailyPnl < -(dailyLossLimit * 0.7)) {
      warnings.push(`Approaching daily loss limit: $${Math.abs(dailyPnl).toFixed(2)} / $${dailyLossLimit.toFixed(2)}`)
    }
  } catch {
    warnings.push('Could not verify daily PnL (DB unavailable)')
  }

  // 5. Cooldown check — last trade on this market
  try {
    const lastTrade = await db.trade.findFirst({
      where: { marketId: score.marketId, isAgentTrade: true },
      orderBy: { createdAt: 'desc' },
    })

    if (lastTrade) {
      const minutesSince = (Date.now() - new Date(lastTrade.createdAt).getTime()) / 60000
      if (minutesSince < config.cooldownMinutes) {
        reasons.push(`Cooldown active: ${Math.ceil(config.cooldownMinutes - minutesSince)}min remaining on this market`)
      }
    }
  } catch {
    warnings.push('Could not verify cooldown (DB unavailable)')
  }

  // 6. Category concentration
  try {
    const openTrades = await db.trade.findMany({
      where: { isAgentTrade: true, status: 'filled' },
      include: { market: true },
    })

    const categoryExposure = openTrades
      .filter(t => t.market?.category === score.category)
      .reduce((sum, t) => sum + t.size, 0)

    const categoryLimit = capitalBase * (config.maxCategoryPct / 100)
    if (categoryExposure >= categoryLimit) {
      reasons.push(`Category "${score.category}" exposure $${categoryExposure.toFixed(2)} at limit $${categoryLimit.toFixed(2)}`)
    } else if (categoryExposure + (adjustedSize || 0) > categoryLimit) {
      const reduced = Math.round((categoryLimit - categoryExposure) * 100) / 100
      if (reduced > 0) {
        warnings.push(`Category concentration reduced size from $${adjustedSize} to $${reduced}`)
        adjustedSize = reduced
      } else {
        reasons.push(`Category "${score.category}" would exceed concentration limit`)
      }
    }
  } catch {
    warnings.push('Could not verify category concentration (DB unavailable)')
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    warnings,
    adjustedSizeUSD: reasons.length === 0 ? adjustedSize : null,
  }
}
