import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const news = await db.newsEvent.findMany({
      take: 20,
      orderBy: { publishedAt: 'desc' },
    })

    return NextResponse.json(news)
  } catch (error) {
    logger.error('NewsAPI', 'Failed to fetch news', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
