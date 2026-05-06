import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function randomFloat(min: number, max: number, decimals = 2): number {
  const val = Math.random() * (max - min) + min
  return parseFloat(val.toFixed(decimals))
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateEthAddress(): string {
  const chars = '0123456789abcdef'
  let addr = '0x'
  for (let i = 0; i < 40; i++) {
    addr += chars[Math.floor(Math.random() * chars.length)]
  }
  return addr
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function main() {
  // Clean existing data
  await prisma.agentDecision.deleteMany()
  await prisma.agentState.deleteMany()
  await prisma.newsEvent.deleteMany()
  await prisma.trade.deleteMany()
  await prisma.market.deleteMany()
  await prisma.wallet.deleteMany()

  // ─── Wallets ─────────────────────────────────────────────
  const edgeTraderLabels = [
    'Whale Alpha',
    'Sharp Money',
    'The Oracle',
    'Statistical Edge',
    'Deep Research',
    'Quant Whale',
    'Inside Line',
  ]

  const regularTraderLabels = [
    'Degen Dave',
    'YOLO Trader',
    'FOMO Fred',
    'HODL Hank',
    'Pump Chaser',
    'Rug Victim',
    'Casino Carl',
    'Late Larry',
  ]

  const edgeWallets = edgeTraderLabels.map((label) => ({
    address: generateEthAddress(),
    label,
    totalPnl: randomFloat(5000, 500000),
    winRate: randomFloat(0.65, 0.82, 3),
    totalTrades: randomInt(200, 1500),
    avgPositionSize: randomFloat(500, 10000),
    edgeScore: randomFloat(0.7, 0.95, 3),
    isEdgeTrader: true,
    firstSeen: new Date(Date.now() - randomInt(30, 365) * 86400000),
    lastActive: new Date(Date.now() - randomInt(0, 3) * 86400000),
  }))

  const regularWallets = regularTraderLabels.map((label) => ({
    address: generateEthAddress(),
    label,
    totalPnl: randomFloat(-2000, 1000),
    winRate: randomFloat(0.4, 0.55, 3),
    totalTrades: randomInt(50, 300),
    avgPositionSize: randomFloat(50, 1000),
    edgeScore: randomFloat(0.1, 0.4, 3),
    isEdgeTrader: false,
    firstSeen: new Date(Date.now() - randomInt(10, 200) * 86400000),
    lastActive: new Date(Date.now() - randomInt(0, 14) * 86400000),
  }))

  const allWallets = await Promise.all(
    [...edgeWallets, ...regularWallets].map((w) => prisma.wallet.create({ data: w }))
  )

  // ─── Markets ─────────────────────────────────────────────
  const marketsData = [
    {
      title: 'Will BTC hit $150k by end of 2025?',
      slug: 'btc-150k-2025',
      category: 'crypto',
      yesPrice: 0.32,
      noPrice: 0.68,
      volume: 12450000,
      liquidity: 3200000,
      mispricingScore: 0.78,
      endDate: new Date('2025-12-31'),
    },
    {
      title: 'Will Ethereum flip Bitcoin in market cap by 2026?',
      slug: 'eth-flip-btc-2026',
      category: 'crypto',
      yesPrice: 0.08,
      noPrice: 0.92,
      volume: 5200000,
      liquidity: 1400000,
      mispricingScore: 0.15,
      endDate: new Date('2026-12-31'),
    },
    {
      title: 'Will the Fed cut rates in Q2 2025?',
      slug: 'fed-cut-q2-2025',
      category: 'economics',
      yesPrice: 0.61,
      noPrice: 0.39,
      volume: 8900000,
      liquidity: 2100000,
      mispricingScore: 0.42,
      endDate: new Date('2025-06-30'),
    },
    {
      title: 'Will AI cause a major market crash by 2026?',
      slug: 'ai-market-crash-2026',
      category: 'science',
      yesPrice: 0.14,
      noPrice: 0.86,
      volume: 3100000,
      liquidity: 890000,
      mispricingScore: 0.22,
      endDate: new Date('2026-12-31'),
    },
    {
      title: 'Next US President - Republican wins 2028?',
      slug: 'next-us-president-republican-2028',
      category: 'politics',
      yesPrice: 0.55,
      noPrice: 0.45,
      volume: 25800000,
      liquidity: 6500000,
      mispricingScore: 0.82,
      endDate: new Date('2028-11-07'),
    },
    {
      title: 'Will SOL reach $500 by end of 2025?',
      slug: 'sol-500-2025',
      category: 'crypto',
      yesPrice: 0.28,
      noPrice: 0.72,
      volume: 4300000,
      liquidity: 1200000,
      mispricingScore: 0.73,
      endDate: new Date('2025-12-31'),
    },
    {
      title: 'Will there be a recession in the US in 2025?',
      slug: 'us-recession-2025',
      category: 'economics',
      yesPrice: 0.22,
      noPrice: 0.78,
      volume: 7100000,
      liquidity: 1800000,
      mispricingScore: 0.35,
      endDate: new Date('2025-12-31'),
    },
    {
      title: 'Will a human land on Mars by 2030?',
      slug: 'mars-landing-2030',
      category: 'science',
      yesPrice: 0.12,
      noPrice: 0.88,
      volume: 2100000,
      liquidity: 560000,
      mispricingScore: null,
      endDate: new Date('2030-12-31'),
    },
    {
      title: 'Lakers win NBA Championship 2025?',
      slug: 'lakers-nba-2025',
      category: 'sports',
      yesPrice: 0.09,
      noPrice: 0.91,
      volume: 1800000,
      liquidity: 420000,
      mispricingScore: null,
      endDate: new Date('2025-06-30'),
    },
    {
      title: 'Will China invade Taiwan by 2027?',
      slug: 'china-taiwan-2027',
      category: 'politics',
      yesPrice: 0.11,
      noPrice: 0.89,
      volume: 5600000,
      liquidity: 1500000,
      mispricingScore: 0.18,
      endDate: new Date('2027-12-31'),
    },
    {
      title: 'Will DeFi TVL exceed $500B by 2025?',
      slug: 'defi-tvl-500b-2025',
      category: 'crypto',
      yesPrice: 0.35,
      noPrice: 0.65,
      volume: 2900000,
      liquidity: 780000,
      mispricingScore: 0.88,
      endDate: new Date('2025-12-31'),
    },
    {
      title: 'Will a new pandemic be declared in 2025?',
      slug: 'pandemic-2025',
      category: 'science',
      yesPrice: 0.07,
      noPrice: 0.93,
      volume: 1500000,
      liquidity: 340000,
      mispricingScore: null,
      endDate: new Date('2025-12-31'),
    },
  ]

  const allMarkets = await Promise.all(
    marketsData.map((m) => prisma.market.create({ data: m }))
  )

  // ─── Trades ──────────────────────────────────────────────
  const sides = ['YES', 'NO']
  const statuses = ['filled', 'filled', 'filled', 'filled', 'pending']
  const agentReasonings = [
    'Edge traders showing strong convergence on YES side. Kelly fraction suggests 12% allocation.',
    'Mispricing detected: market price 0.32 vs model price 0.45. Taking YES position.',
    'Whale Alpha and Sharp Money both accumulating YES. Following smart money signal.',
    'Cross-market correlation with BTC-150k market suggests undervalued NO side.',
    'Statistical model indicates 73% true probability vs 61% market. Medium conviction YES.',
    'News catalyst incoming. Positioning for positive sentiment shift on YES.',
    'High mispricing score (0.88) with edge confirmation. Aggressive Kelly sizing.',
    'Risk/reward favorable at current price. Half-Kelly for prudent exposure.',
    'Multiple edge traders exiting NO positions. Contrarian YES play.',
    'Liquidity depth supports large position without significant slippage.',
  ]

  const tradesData = []
  for (let i = 0; i < 55; i++) {
    const wallet = randomChoice(allWallets)
    const market = randomChoice(allMarkets)
    const isAgent = i < 20
    const side = randomChoice(sides)
    const price = side === 'YES' ? market.yesPrice : market.noPrice
    const size = isAgent
      ? randomFloat(50, 500)
      : randomFloat(10, 200)
    const hasPnl = Math.random() > 0.3
    const pnl = hasPnl ? (Math.random() > 0.5 ? randomFloat(5, 200) : randomFloat(-100, -5)) : null

    tradesData.push({
      walletId: wallet.id,
      marketId: market.id,
      side,
      size,
      price: parseFloat(price.toFixed(3)),
      kellySize: isAgent ? randomFloat(0.05, 0.25, 3) : null,
      pnl,
      isAgentTrade: isAgent,
      agentReasoning: isAgent ? randomChoice(agentReasonings) : null,
      status: randomChoice(statuses),
      createdAt: new Date(Date.now() - randomInt(0, 48) * 3600000),
    })
  }

  await Promise.all(tradesData.map((t) => prisma.trade.create({ data: t })))

  // ─── Agent State ─────────────────────────────────────────
  await prisma.agentState.create({
    data: {
      status: 'running',
      currentStrategy: 'Cross-market arbitrage with Kelly sizing',
      totalPnl: 4212,
      totalTrades: 94,
      winRate: 0.787,
      sharpeRatio: 3.24,
      maxDrawdown: 0.08,
      startedAt: new Date(Date.now() - 8 * 3600000),
      lastDecisionAt: new Date(Date.now() - 2 * 60000),
      capitalBase: 25,
      currentCapital: 4237,
    },
  })

  // ─── News Events ─────────────────────────────────────────
  const newsEventsData = [
    {
      title: 'Federal Reserve signals potential rate cut in upcoming meeting',
      source: 'Reuters',
      category: 'economics',
      sentiment: 0.65,
      impactScore: 0.9,
      processedByAgent: true,
      agentAction: 'Increased YES position on Fed rate cut market',
      publishedAt: new Date(Date.now() - 1 * 3600000),
    },
    {
      title: 'Bitcoin surges past $100k resistance level',
      source: 'CoinDesk',
      category: 'crypto',
      sentiment: 0.82,
      impactScore: 0.85,
      processedByAgent: true,
      agentAction: 'Re-evaluated BTC-150k probability upward',
      publishedAt: new Date(Date.now() - 2 * 3600000),
    },
    {
      title: 'New regulatory framework proposed for DeFi protocols',
      source: 'Bloomberg',
      category: 'crypto',
      sentiment: -0.3,
      impactScore: 0.7,
      processedByAgent: true,
      agentAction: 'Reduced DeFi TVL market exposure',
      publishedAt: new Date(Date.now() - 3 * 3600000),
    },
    {
      title: 'US GDP growth exceeds expectations at 3.2%',
      source: 'CNBC',
      category: 'economics',
      sentiment: 0.55,
      impactScore: 0.75,
      processedByAgent: false,
      publishedAt: new Date(Date.now() - 4 * 3600000),
    },
    {
      title: 'Ethereum Shanghai upgrade shows promising results',
      source: 'The Block',
      category: 'crypto',
      sentiment: 0.7,
      impactScore: 0.65,
      processedByAgent: true,
      agentAction: 'Monitoring ETH-flip-BTC market for entry',
      publishedAt: new Date(Date.now() - 5 * 3600000),
    },
    {
      title: 'Geopolitical tensions rise in the South China Sea',
      source: 'AP News',
      category: 'politics',
      sentiment: -0.6,
      impactScore: 0.5,
      processedByAgent: false,
      publishedAt: new Date(Date.now() - 6 * 3600000),
    },
    {
      title: 'AI breakthrough: New model surpasses human-level reasoning',
      source: 'Wired',
      category: 'science',
      sentiment: 0.4,
      impactScore: 0.55,
      processedByAgent: false,
      publishedAt: new Date(Date.now() - 7 * 3600000),
    },
    {
      title: 'Solana network processes record 100M transactions in a day',
      source: 'CoinTelegraph',
      category: 'crypto',
      sentiment: 0.75,
      impactScore: 0.6,
      processedByAgent: true,
      agentAction: 'Adjusting SOL-500 market probability estimate',
      publishedAt: new Date(Date.now() - 8 * 3600000),
    },
    {
      title: 'Consumer confidence index drops to 6-month low',
      source: 'Financial Times',
      category: 'economics',
      sentiment: -0.45,
      impactScore: 0.65,
      processedByAgent: true,
      agentAction: 'Slight increase in recession market YES position',
      publishedAt: new Date(Date.now() - 10 * 3600000),
    },
    {
      title: 'SpaceX announces new Mars mission timeline',
      source: 'Space News',
      category: 'science',
      sentiment: 0.6,
      impactScore: 0.35,
      processedByAgent: false,
      publishedAt: new Date(Date.now() - 12 * 3600000),
    },
  ]

  await Promise.all(
    newsEventsData.map((n) => prisma.newsEvent.create({ data: n }))
  )

  // ─── Agent Decisions ─────────────────────────────────────
  const decisionTypes = ['scan', 'analyze', 'trade', 'hold', 'exit']
  const decisionReasonings: Record<string, string[]> = {
    scan: [
      'Scanning wallet activity for edge trader patterns. Found 3 new large positions on BTC-150k market.',
      'Market scan complete. Detected unusual volume on Fed rate cut market. 4 edge traders active.',
      'Cross-referencing news events with market movements. Correlation spike on DeFi TVL market.',
      'Monitoring smart money flow. Whale Alpha moved $45k into politics markets.',
    ],
    analyze: [
      'Analyzing mispricing on BTC-150k. Model price: 0.45, Market: 0.32. Edge: 13bps.',
      'Kelly criterion calculation for SOL-500 market. Optimal sizing: 18% of capital.',
      'Correlation analysis: BTC and DeFi markets showing 0.73 correlation. Diversification benefit limited.',
      'Sentiment analysis of recent news: Net positive for crypto markets. Impact score 0.82.',
    ],
    trade: [
      'Executing YES position on BTC-150k. Size: $87.50 (0.18 Kelly). Confidence: 0.85.',
      'Opening NO position on recession market. Size: $62.30 (0.12 Kelly). Confidence: 0.72.',
      'Entering YES on DeFi TVL market. Mispricing: 0.88. Size: $125 (0.25 Kelly). High conviction.',
      'Partial exit on Fed rate cut YES position. Locking in $34.20 profit. Maintaining core position.',
    ],
    hold: [
      'Holding current positions. No significant market changes detected. Portfolio delta neutral.',
      'Market volatility low. Holding pattern. Next scan in 15 minutes.',
      'Edge trader positions unchanged. No new signals. Maintaining current allocation.',
    ],
    exit: [
      'Exiting SOL-500 position. Edge traders reducing exposure. Stop-loss triggered at -8%.',
      'Full exit on pandemic market. No edge detected. Reclaiming capital for better opportunities.',
      'Closing China-Taiwan position. Risk/reward deteriorated. Taking small loss of $12.40.',
      'Exited recession market NO position. Market moved against prediction. Loss: $23.50.',
    ],
  }

  const outcomes = ['success', 'failure', 'pending']

  for (let i = 0; i < 20; i++) {
    const type = decisionTypes[i % 5]
    const reasonings = decisionReasonings[type]
    const reasoning = reasonings[i % reasonings.length]
    const hasMarket = type === 'trade' || type === 'analyze' || type === 'exit'
    const market = hasMarket ? randomChoice(allMarkets) : null

    const hasOutcome = type === 'trade' || type === 'exit'
    const outcome = hasOutcome
      ? (Math.random() > 0.3 ? 'success' : 'failure')
      : (Math.random() > 0.5 ? 'pending' : null)
    const pnl = outcome === 'success'
      ? randomFloat(5, 150)
      : outcome === 'failure'
        ? randomFloat(-80, -5)
        : null

    await prisma.agentDecision.create({
      data: {
        type,
        reasoning,
        confidence: randomFloat(0.5, 0.98, 2),
        marketId: market?.id ?? null,
        action: type === 'trade' ? `PLACE_${randomChoice(['YES', 'NO'])}` : type === 'exit' ? 'CLOSE_POSITION' : type === 'hold' ? 'WAIT' : null,
        size: type === 'trade' ? randomFloat(30, 200) : null,
        kellyFraction: type === 'trade' ? randomFloat(0.05, 0.25, 3) : null,
        outcome,
        pnl,
        createdAt: new Date(Date.now() - (i * 15 + randomInt(0, 10)) * 60000),
      },
    })
  }

  console.log('✅ Seed data created successfully!')
  console.log(`  - ${allWallets.length} wallets (${edgeWallets.length} edge traders)`)
  console.log(`  - ${allMarkets.length} markets`)
  console.log(`  - ${tradesData.length} trades`)
  console.log(`  - 1 agent state`)
  console.log(`  - ${newsEventsData.length} news events`)
  console.log(`  - 20 agent decisions`)
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
