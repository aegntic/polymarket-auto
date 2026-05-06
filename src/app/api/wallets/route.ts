import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const wallets = await db.wallet.findMany({
      orderBy: { edgeScore: 'desc' },
      include: {
        _count: {
          select: { trades: true },
        },
      },
    })

    const result = wallets.map((w) => ({
      id: w.id,
      address: w.address,
      label: w.label,
      totalPnl: w.totalPnl,
      winRate: w.winRate,
      totalTrades: w.totalTrades,
      avgPositionSize: w.avgPositionSize,
      edgeScore: w.edgeScore,
      isEdgeTrader: w.isEdgeTrader,
      firstSeen: w.firstSeen,
      lastActive: w.lastActive,
      tradeCount: w._count.trades,
    }))

    return NextResponse.json(result)
  } catch (error) {
    logger.error('WalletsAPI', 'Failed to fetch wallets', error)
    return NextResponse.json({ error: 'Failed to fetch wallets' }, { status: 500 })
  }
}
