import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { winProb, odds, bankroll } = body

    if (
      typeof winProb !== 'number' ||
      typeof odds !== 'number' ||
      typeof bankroll !== 'number'
    ) {
      return NextResponse.json(
        { error: 'winProb, odds, and bankroll must be numbers' },
        { status: 400 }
      )
    }

    if (winProb <= 0 || winProb >= 1) {
      return NextResponse.json(
        { error: 'winProb must be between 0 and 1 (exclusive)' },
        { status: 400 }
      )
    }

    if (odds <= 0) {
      return NextResponse.json(
        { error: 'odds must be positive' },
        { status: 400 }
      )
    }

    if (bankroll <= 0) {
      return NextResponse.json(
        { error: 'bankroll must be positive' },
        { status: 400 }
      )
    }

    // Kelly criterion: f* = (bp - q) / b
    // where b = odds - 1 (net odds), p = winProb, q = 1 - p
    const b = odds - 1
    const q = 1 - winProb
    const kellyFraction = (b * winProb - q) / b

    // If Kelly is negative, the bet is not favorable
    if (kellyFraction <= 0) {
      return NextResponse.json({
        kellyFraction: 0,
        optimalSize: 0,
        halfKelly: 0,
        quarterKelly: 0,
        recommendation: 'No edge detected. Do not bet.',
      })
    }

    // Cap Kelly at 1.0 (100%)
    const cappedKelly = Math.min(kellyFraction, 1.0)
    const optimalSize = parseFloat((cappedKelly * bankroll).toFixed(2))
    const halfKelly = parseFloat((cappedKelly * 0.5).toFixed(4))
    const quarterKelly = parseFloat((cappedKelly * 0.25).toFixed(4))

    return NextResponse.json({
      kellyFraction: parseFloat(cappedKelly.toFixed(4)),
      optimalSize,
      halfKelly,
      quarterKelly,
    })
  } catch (error) {
    logger.error('KellyAPI', 'Kelly calculation failed', error)
    return NextResponse.json({ error: 'Kelly calculation failed' }, { status: 500 })
  }
}
