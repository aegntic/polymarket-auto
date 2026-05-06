// Test script for xAI agent
const testData = {
  newsTitle: "Bitcoin ETF approved by SEC",
  newsSentiment: 0.8,
  marketTitle: "Will BTC hit $100k?",
  yesPrice: 0.65,
  noPrice: 0.35,
  bankroll: 1000,
}

const response = await fetch('http://localhost:3000/api/agent-decide', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData),
})

const result = await response.json()
console.log('Status:', response.status)
console.log('Result:', JSON.stringify(result, null, 2))
