import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    // Generate performance time series data
    // Simulates capital growth from $25 to $4,237 over ~8 hours
    const totalPoints = 50
    const startCapital = 25
    const endCapital = 4237
    const startTime = Date.now() - 8 * 3600000 // 8 hours ago
    const interval = (8 * 3600000) / (totalPoints - 1)

    const data = []

    // Use a compounding growth curve with some noise
    // Capital grows exponentially: C(t) = C0 * (C_end/C0)^(t/T)
    const growthRate = Math.log(endCapital / startCapital)

    let cumulativeTrades = 0

    for (let i = 0; i < totalPoints; i++) {
      const t = i / (totalPoints - 1) // 0 to 1
      const timestamp = new Date(startTime + i * interval)

      // Exponential growth base
      let capital = startCapital * Math.exp(growthRate * t)

      // Add realistic noise / drawdowns
      const noise = Math.sin(i * 0.7) * 0.05 + Math.sin(i * 1.3) * 0.03 + Math.sin(i * 2.1) * 0.02
      capital = capital * (1 + noise)

      // Ensure capital stays positive and doesn't exceed endCapital at the end
      capital = Math.max(capital, startCapital)
      if (i === totalPoints - 1) {
        capital = endCapital
      }

      // Drawdown calculation (relative to peak)
      const peakSoFar = startCapital * Math.exp(growthRate * t) * 1.05
      const drawdown = Math.max(0, (peakSoFar - capital) / peakSoFar)

      // Trades increment (more trades as capital grows)
      const tradeIncrement = Math.floor(Math.random() * 3) + (capital > 500 ? 2 : 1)
      cumulativeTrades += tradeIncrement

      data.push({
        timestamp: timestamp.toISOString(),
        capital: parseFloat(capital.toFixed(2)),
        trades: cumulativeTrades,
        drawdown: parseFloat(drawdown.toFixed(4)),
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    logger.error('PerformanceAPI', 'Failed to generate performance data', error)
    return NextResponse.json({ error: 'Failed to generate performance data' }, { status: 500 })
  }
}
