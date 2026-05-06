import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// xAI API key from environment
const XAI_API_KEY = process.env.XAI_API_KEY

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
            content: `You are an autonomous Polymarket trading agent. You analyze news and market data to make trading decisions. You use Kelly criterion for position sizing. You are conservative but decisive. You respond in JSON format only.\n\nYour decision framework:\n1. Assess news impact on the market\n2. Determine if there's a mispricing (difference between implied and true probability)\n3. Calculate edge\n4. Decide: BUY YES, BUY NO, or HOLD\n5. Size position using quarter-Kelly (conservative)\n\nRespond with this exact JSON structure:\n{\n  \"decision\": \"BUY YES\" | \"BUY NO\" | \"HOLD\",\n  \"confidence\": 0.0-1.0,\n  \"edge\": number (basis points),\n  \"kellyFraction\": number,\n  \"positionSize\": number,\n  \"reasoning\": \"detailed string explaining the analysis\",\n  \"trueProbability\": number,\n  \"impliedProbability\": number\n}`,\n          },
          {
            role: 'user',
            content: `Analyze this situation:\n\nNews: "${newsTitle}" (Sentiment: ${newsSentiment > 0 ? 'Bullish' : newsSentiment < 0 ? 'Bearish' : 'Neutral'}, Score: ${newsSentiment})\n\nMarket: "${marketTitle}"\nCurrent Prices: YES ${(yesPrice * 100).toFixed(1)}¢ / NO ${(noPrice * 100).toFixed(1)}¢\n\nBankroll: $${bankroll}\n\nWhat is your decision?`,\n          },\n        ],\n        temperature: 0.3,\n      }),\n    })\n\n    if (!response.ok) {\n      const errorText = await response.text()\n      logger.error('AgentDecideAPI', 'xAI API error', { status: response.status, details: errorText })\n      return NextResponse.json(\n        { error: `xAI API error: ${response.status}`, details: errorText },\n        { status: 500 }\n      )\n    }\n\n    const data = await response.json()\n    const content = data.choices?.[0]?.message?.content || ''\n\n    // Try to parse JSON from the response\n    let parsed\n    try {\n      // Extract JSON from response (might have markdown code blocks)\n      const jsonMatch = content.match(/\\{[\\s\\S]*\\}/)\n      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { decision: 'HOLD', confidence: 0, reasoning: content }\n    } catch {\n      parsed = { decision: 'HOLD', confidence: 0, reasoning: content }\n    }\n\n    return NextResponse.json({\n      ...parsed,\n      model: 'grok-4.20',\n      timestamp: new Date().toISOString(),\n    })\n  } catch (error: any) {\n    logger.error('AgentDecideAPI', 'Agent decision failed', error)\n    return NextResponse.json(\n      { error: 'Agent decision failed', details: error?.message || String(error) },\n      { status: 500 }\n    )\n  }\n}\n