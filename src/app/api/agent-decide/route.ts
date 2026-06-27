import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// xAI API key from environment
const XAI_API_KEY = process.env.XAI_API_KEY

const SYSTEM_PROMPT = `You are an autonomous Polymarket trading agent. You analyze news and market data to make trading decisions. You use Kelly criterion for position sizing. You are conservative but decisive. You respond in JSON format only.

CRITICAL: Bankroll is small (~$100). Keep every trade tiny — hard cap positionSize at $10 maximum. Never exceed $10 even if Kelly suggests more. Prefer $3-8 sizes.

Your decision framework:
1. Assess news impact on the market
2. Determine if there's a mispricing (difference between implied and true probability)
3. Calculate edge
4. Decide: BUY YES, BUY NO, or HOLD
5. Size position using quarter-Kelly but clamped to $3-10 absolute`

Respond with this exact JSON structure:
{
  "decision": "BUY YES" | "BUY NO" | "HOLD",
  "confidence": 0.0-1.0,
  "edge": number (basis points),
  "kellyFraction": number,
  "positionSize": number,
  "reasoning": "detailed string explaining the analysis",
  "trueProbability": number,
  "impliedProbability": number
}`

export async function POST(request: Request) {
  try {
    const { newsTitle, newsSentiment, marketTitle, yesPrice, noPrice, bankroll } = await request.json()

    if (!XAI_API_KEY) {
      return NextResponse.json(
        { error: 'XAI_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Call xAI API directly (OpenAI-compatible endpoint)
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-4.20', // or 'grok-4.3'
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Analyze this situation:

News: "${newsTitle}" (Sentiment: ${newsSentiment > 0 ? 'Bullish' : newsSentiment < 0 ? 'Bearish' : 'Neutral'}, Score: ${newsSentiment})

Market: "${marketTitle}"
Current Prices: YES ${(yesPrice * 100).toFixed(1)}¢ / NO ${(noPrice * 100).toFixed(1)}¢

Bankroll: $${bankroll}

What is your decision?`,
          },
        ],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('AgentDecideAPI', 'xAI API error', { status: response.status, details: errorText })
      return NextResponse.json(
        { error: `xAI API error: ${response.status}`, details: errorText },
        { status: 500 }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Try to parse JSON from the response
    let parsed
    try {
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { decision: 'HOLD', confidence: 0, reasoning: content }
    } catch {
      parsed = { decision: 'HOLD', confidence: 0, reasoning: content }
    }

    return NextResponse.json({
      ...parsed,
      model: 'grok-4.20',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error('AgentDecideAPI', 'Agent decision failed', error)
    return NextResponse.json(
      { error: 'Agent decision failed', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
