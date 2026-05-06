// Polymarket API client
// Docs: https://docs.polymarket.com
// Bypass ISP DNS hijacking: use curl (which works) + child_process

import { exec } from 'child_process'
import { promisify } from 'util'
import { logger } from './logger'

const execPromise = promisify(exec)

const ENDPOINTS = [
  'https://gamma-api.polymarket.com',
  'https://api.polymarket.com',
  'https://clob.polymarket.com',
]

// Known IP addresses for Polymarket endpoints (bypass DNS hijack)
// Resolved via public DNS (1.1.1.1) - update if these change
const DNS_OVERRIDES: Record<string, string> = {
  'gamma-api.polymarket.com': '104.18.33.93',
  'api.polymarket.com': '104.18.33.93',
  'clob.polymarket.com': '104.18.33.93',
}

export interface PolymarketMarket {
  conditionId: string
  question: string
  description: string
  slug: string
  active: boolean
  closed: boolean
  marketMakerAddress: string
  creationTimestamp: number
  makerBaseToken: string
  tokens: Array<{ tokenId: string; outcome: string }>
  outcomePrices: string[] | string // API returns JSON string or parsed array
  volume: number
  liquidity: number
  endDate: string | null
  tags: string[]
  category?: string
  groupItemTitle?: string
}

export interface PolymarketTrade {
  id: string
  marketId: string
  outcome: string // "YES" | "NO"
  price: number
  size: number
  timestamp: number
  walletAddress: string
}

// Fetch using curl with DNS override to bypass ISP hijack
async function fetchWithFallback(path: string): Promise<any> {
  let lastError: Error | null = null

  for (const base of ENDPOINTS) {
    try {
      const url = `${base}${path}`
      const hostname = new URL(base).hostname
      const ip = DNS_OVERRIDES[hostname]
      
      // Build curl command with --resolve to bypass DNS hijack
      let curlCmd = `curl -s --max-time 10 -H "User-Agent: Polymarket-Auto/1.0" -H "Accept: application/json"`
      
      if (ip) {
        // Use --resolve to bypass DNS (format: HOST:PORT:ADDRESS)
        curlCmd += ` --resolve '${hostname}:443:${ip}'`
        logger.debug('PolymarketAPI', `Trying: ${url} (DNS override: ${ip})`)
      } else {
        // Fallback: use public DNS resolver
        curlCmd += ` --dns-servers 1.1.1.1`
        logger.debug('PolymarketAPI', `Trying: ${url} (DNS: 1.1.1.1)`)
      }
      
      curlCmd += ` "${url}"`

      const { stdout, stderr } = await execPromise(curlCmd)

      if (stdout) {
        const data = JSON.parse(stdout)
        if (Array.isArray(data)) {
          logger.debug('PolymarketAPI', `Success: ${base} (${data.length} items)`)
          return data
        } else {
          logger.warn('PolymarketAPI', `${base} returned non-array:`, typeof data)
        }
      } else {
        throw new Error(`No output from curl. stderr: ${stderr}`)
      }
    } catch (error: any) {
      lastError = error
      logger.warn('PolymarketAPI', `${base} failed:`, error?.message || error)
    }
  }

  throw lastError || new Error('All endpoints failed')
}

// Fetch live markets from Polymarket
export async function fetchMarkets(options?: {
  limit?: number
  active?: boolean
  tag?: string
  sortBy?: string
}): Promise<PolymarketMarket[]> {
  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', options.limit.toString())
  if (options?.active !== undefined) params.set('active', options.active.toString())
  if (options?.tag) params.set('tag', options.tag)
  if (options?.sortBy) params.set('sortBy', options.sortBy)

  const path = `/markets?${params.toString()}`

  try {
    const markets = await fetchWithFallback(path)
    return Array.isArray(markets) ? markets : []
  } catch (error: any) {
    logger.error('PolymarketAPI', 'Error fetching markets:', error?.message || error)
    return []
  }
}

// Fetch trades for a specific market
export async function fetchTrades(marketId: string, options?: {
  limit?: number
}): Promise<PolymarketTrade[]> {
  const params = new URLSearchParams()
  params.set('market', marketId)
  if (options?.limit) params.set('limit', options.limit.toString())

  const path = `/trades?${params.toString()}`

  try {
    const trades = await fetchWithFallback(path)
    return Array.isArray(trades) ? trades : []
  } catch (error: any) {
    logger.error('PolymarketAPI', 'Error fetching trades:', error?.message || error)
    return []
  }
}

// Convert Polymarket market to our internal Market interface
export function normalizeMarket(pm: PolymarketMarket) {
  // Parse outcomePrices - API returns it as a JSON string
  let yesPrice = 0.5
  let noPrice = 0.5
  
  if (pm.outcomePrices) {
    try {
      const prices = typeof pm.outcomePrices === 'string' 
        ? JSON.parse(pm.outcomePrices) 
        : pm.outcomePrices
      yesPrice = parseFloat(prices[0] || '0.5')
      noPrice = parseFloat(prices[1] || '0.5')
    } catch (e) {
      logger.warn('PolymarketAPI', 'Failed to parse outcomePrices:', pm.outcomePrices)
    }
  }

  return {
    id: pm.conditionId,
    title: pm.question,
    slug: pm.slug,
    category: pm.tags?.[0]?.toLowerCase() || 'crypto',
    yesPrice,
    noPrice,
    volume: pm.volume || 0,
    liquidity: pm.liquidity || 0,
    mispricingScore: null,
    endDate: pm.endDate || null,
    isActive: pm.active && !pm.closed,
    tradeCount: 0,
  }
}

// Convert Polymarket trade to our internal Trade interface
export function normalizeTrade(pm: PolymarketTrade, marketTitle?: string) {
  return {
    id: pm.id,
    walletId: pm.walletAddress,
    marketId: pm.marketId,
    side: pm.outcome,
    size: pm.size,
    price: pm.price,
    kellySize: null,
    pnl: null,
    isAgentTrade: false,
    agentReasoning: null,
    status: 'filled',
    createdAt: new Date(pm.timestamp * 1000).toISOString(),
    wallet: {
      id: pm.walletAddress,
      address: pm.walletAddress,
      label: null,
      isEdgeTrader: false,
    },
    market: {
      id: pm.marketId,
      title: marketTitle || 'Unknown Market',
      slug: '',
      category: 'crypto',
    },
  }
}
