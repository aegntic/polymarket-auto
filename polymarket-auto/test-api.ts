// Test script to verify Polymarket API client
import { fetchMarkets, fetchTrades, normalizeMarket } from './src/lib/polymarket-api.ts'

async function test() {
  console.log('Testing Polymarket API client...')
  
  try {
    // Test fetchMarkets
    console.log('\n1. Fetching markets...')
    const markets = await fetchMarkets({ limit: 3 })
    console.log(`✓ Got ${markets.length} markets`)
    
    if (markets.length > 0) {
      console.log('First market:', {
        id: markets[0].conditionId,
        question: markets[0].question?.slice(0, 50),
        active: markets[0].active,
      })
      
      // Test normalizeMarket
      const normalized = normalizeMarket(markets[0])
      console.log('Normalized:', {
        id: normalized.id,
        title: normalized.title?.slice(0, 50),
        yesPrice: normalized.yesPrice,
        noPrice: normalized.noPrice,
      })
    }
    
    console.log('\n✓ All tests passed!')
  } catch (error) {
    console.error('✗ Test failed:', error)
    process.exit(1)
  }
}

test()
