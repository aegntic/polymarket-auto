import { createServer } from 'http'
import { Server } from 'socket.io'

// ──────────────────────────────────────────────
// HTTP & Socket.IO setup
// ──────────────────────────────────────────────

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ──────────────────────────────────────────────
// Simulated data arrays
// ──────────────────────────────────────────────

const MARKETS = [
  'Will BTC hit $150k by 2025?',
  'Federal rate cut before July?',
  'Tesla stock above $300 by Q2?',
  'China GDP growth >5%?',
  'SpaceX Mars landing by 2030?',
  'Ethereum ETF approval by June?',
  'AI regulation bill passes Senate?',
  'Next Pope from South America?',
]

const AGENT_REASONINGS = [
  'Cross-referencing wallet 0xf3a1...movement with news sentiment. 3-sigma deviation detected. Kelly fraction: 0.23. Executing.',
  'Market mispricing detected: implied probability 0.42, model probability 0.61. Edge: +19bp. Sizing up.',
  'Whale accumulation pattern matched. 4 of 7 edge wallets positioned YES. Following smart money.',
  'Volatility compression pre-event. Straddle pricing inefficiency. Buying both sides with asymmetric sizing.',
  'News impact score 0.87 but market hasn\'t moved. 2.1x edge. Deploying quarter-Kelly.',
  'Mean reversion signal. Price deviated 2.3σ from model. 78% confidence in reversal.',
  'Liquidity gap at 0.55 strike. Market maker absent. Exploiting with limit orders.',
  'Sentiment shift detected across 3 news sources. Recalibrating model. New edge: +14bp.',
]

const NEWS_HEADLINES = [
  'SEC announces emergency crypto regulation review',
  'Federal Reserve signals unexpected rate decision',
  'Bitcoin mining difficulty hits all-time high',
  'Major exchange reports unusual whale activity',
  'Congressional committee votes on AI regulation',
  'Central bank digital currency pilot launches early',
  'Supply chain disruption sends commodity prices surging',
  'Tech giant announces surprise acquisition in blockchain sector',
]

const NEWS_SOURCES: Array<'Reuters' | 'Bloomberg' | 'AP' | 'Twitter/X'> = [
  'Reuters',
  'Bloomberg',
  'AP',
  'Twitter/X',
]

const NEWS_CATEGORIES: Array<'crypto' | 'politics' | 'economics'> = [
  'crypto',
  'politics',
  'economics',
]

const DECISION_TYPES: Array<'scan' | 'analyze' | 'trade' | 'hold' | 'exit'> = [
  'scan',
  'analyze',
  'trade',
  'hold',
  'exit',
]

const SIDES: Array<'YES' | 'NO'> = ['YES', 'NO']

// ──────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────

let tradeCounter = 0

function generateId(): string {
  tradeCounter += 1
  return `trade-${Date.now()}-${tradeCounter}`
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randRange(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function randInt(min: number, max: number): number {
  return Math.floor(randRange(min, max + 1))
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

// ──────────────────────────────────────────────
// Running capital tracker
// ──────────────────────────────────────────────

let runningCapital = 25 // Starting capital (matches agent state)

// ──────────────────────────────────────────────
// Event generators
// ──────────────────────────────────────────────

function generateTrade() {
  const side = pick(SIDES)
  const size = roundTo(randRange(50, 500), 2)
  const price = roundTo(randRange(0.1, 0.9), 2)
  const market = pick(MARKETS)
  const isAgent = Math.random() > 0.4 // 60% chance agent trade

  // Calculate PnL for agent trades
  let pnl: number | null = null
  if (isAgent && Math.random() > 0.3) {
    pnl = roundTo(runningCapital * randRange(-0.02, 0.05), 2)
    runningCapital += pnl
  }

  // Kelly size for agent trades
  let kellySize: number | null = null
  if (isAgent) {
    kellySize = roundTo(randRange(0.05, 0.35), 4)
  }

  // Reasoning for agent trades
  let reasoning: string | null = null
  if (isAgent) {
    reasoning = pick(AGENT_REASONINGS)
  }

  const trade = {
    id: generateId(),
    side,
    size,
    price,
    market,
    isAgent,
    pnl,
    kellySize,
    reasoning,
    timestamp: new Date().toISOString(),
  }

  io.emit('new-trade', trade)
  console.log(`[TRADE] ${side} ${size} @ ${price} on "${market}"${isAgent ? ' (agent)' : ''}`)
}

function generateAgentDecision() {
  const type = pick(DECISION_TYPES)
  const confidence = roundTo(randRange(0.5, 0.98), 2)
  const market = pick(MARKETS)
  const reasoning = pick(AGENT_REASONINGS)

  // Map decision type to likely action
  let action: 'BUY YES' | 'BUY NO' | 'HOLD' | 'EXIT'
  if (type === 'trade') {
    action = Math.random() > 0.5 ? 'BUY YES' : 'BUY NO'
  } else if (type === 'hold' || type === 'scan' || type === 'analyze') {
    action = 'HOLD'
  } else {
    action = 'EXIT'
  }

  const size = roundTo(randRange(20, 300), 2)
  const kellyFraction = roundTo(randRange(0.05, 0.4), 4)

  const decision = {
    type,
    reasoning,
    confidence,
    market,
    action,
    size,
    kellyFraction,
    timestamp: new Date().toISOString(),
  }

  io.emit('agent-decision', decision)
  console.log(`[DECISION] ${type} → ${action} on "${market}" (conf: ${confidence})`)
}

function generateMarketUpdate() {
  const market = pick(MARKETS)
  const yesPrice = roundTo(randRange(0.1, 0.9), 2)
  const noPrice = roundTo(1 - yesPrice, 2)
  const volume = randInt(5000, 500000)
  const mispricingScore: number | null = Math.random() > 0.3 ? roundTo(randRange(0, 0.5), 3) : null

  const update = {
    market,
    yesPrice,
    noPrice,
    volume,
    mispricingScore,
    timestamp: new Date().toISOString(),
  }

  io.emit('market-update', update)
  console.log(`[MARKET] "${market}" YES=${yesPrice} NO=${noPrice} vol=${volume}`)
}

function generateNewsAlert() {
  const title = pick(NEWS_HEADLINES)
  const source = pick(NEWS_SOURCES)
  const category = pick(NEWS_CATEGORIES)
  const sentiment = roundTo(randRange(-1, 1), 2)
  const impactScore = roundTo(randRange(0, 1), 2)

  const alert = {
    title,
    source,
    category,
    sentiment,
    impactScore,
    timestamp: new Date().toISOString(),
  }

  io.emit('news-alert', alert)
  console.log(`[NEWS] "${title}" (${source}, sentiment: ${sentiment})`)
}

// ──────────────────────────────────────────────
// Connection handler
// ──────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Send initial state to the newly connected client
  socket.emit('initial-state', {
    capital: roundTo(runningCapital, 2),
    activeMarkets: MARKETS.length,
    timestamp: new Date().toISOString(),
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

// ──────────────────────────────────────────────
// Periodic emitters with random intervals
// ──────────────────────────────────────────────

function scheduleTrade() {
  const delay = randInt(3000, 8000)
  setTimeout(() => {
    generateTrade()
    scheduleTrade()
  }, delay)
}

function scheduleAgentDecision() {
  const delay = randInt(10000, 20000)
  setTimeout(() => {
    generateAgentDecision()
    scheduleAgentDecision()
  }, delay)
}

function scheduleMarketUpdate() {
  const delay = randInt(15000, 30000)
  setTimeout(() => {
    generateMarketUpdate()
    scheduleMarketUpdate()
  }, delay)
}

function scheduleNewsAlert() {
  const delay = randInt(20000, 40000)
  setTimeout(() => {
    generateNewsAlert()
    scheduleNewsAlert()
  }, delay)
}

// ──────────────────────────────────────────────
// Periodic capital update (every 5 seconds)
// ──────────────────────────────────────────────

setInterval(() => {
  // Simulate gradual capital growth with small random changes
  runningCapital += runningCapital * randRange(-0.003, 0.008)
  io.emit('capital-update', {
    capital: roundTo(runningCapital, 2),
    timestamp: new Date().toISOString(),
  })
}, 5000)

// ──────────────────────────────────────────────
// Start server with port retry for bun --hot compatibility
// ──────────────────────────────────────────────

const PORT = 3003
const MAX_RETRIES = 5
const RETRY_DELAY = 1000

function startServer(retryCount = 0) {
  httpServer.listen(PORT, () => {
    console.log(`Trade Feed WebSocket server running on port ${PORT}`)
    console.log('Starting event emitters...')

    // Kick off all the schedulers
    scheduleTrade()
    scheduleAgentDecision()
    scheduleMarketUpdate()
    scheduleNewsAlert()

    // Emit an initial burst so new clients see data quickly
    setTimeout(() => generateTrade(), 1000)
    setTimeout(() => generateAgentDecision(), 2500)
    setTimeout(() => generateMarketUpdate(), 4000)
    setTimeout(() => generateNewsAlert(), 5500)
  })

  httpServer.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE' && retryCount < MAX_RETRIES) {
      console.log(`Port ${PORT} in use, retrying in ${RETRY_DELAY}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      setTimeout(() => {
        httpServer.close()
        startServer(retryCount + 1)
      }, RETRY_DELAY)
    } else {
      console.error('Server error:', error)
      process.exit(1)
    }
  })
}

startServer()

// Graceful shutdown — close server immediately so bun --hot can restart cleanly
function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, shutting down server...`)
  io.disconnectSockets(true)
  httpServer.close(() => {
    console.log('Trade Feed server closed')
    process.exit(0)
  })
  // Force exit after 2s if close doesn't complete
  setTimeout(() => {
    console.log('Forcing exit after timeout')
    process.exit(0)
  }, 2000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'))
