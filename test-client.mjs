// Test script to check what's happening client-side
// Run this in browser console at <http://localhost:3000>

async function testAPIs() {
  console.log('Testing API routes...')
  
  // Test markets API
  try {
    const markets = await fetch('/api/markets?limit=2').then(r => r.json())
    console.log('Markets:', markets)
  } catch (e) {
    console.error('Markets error:', e)
  }
  
  // Test agent API
  try {
    const agent = await fetch('/api/agent-decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newsTitle: "Bitcoin ETF approved",
        newsSentiment: 0.8,
        marketTitle: "Will BTC hit $100k?",
        yesPrice: 0.65,
        noPrice: 0.35,
        bankroll: 1000
      })
    }).then(r => r.json())
    console.log('Agent:', agent)
  } catch (e) {
    console.error('Agent error:', e)
  }
}

testAPIs()
