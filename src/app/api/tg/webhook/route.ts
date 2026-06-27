import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://polymarket-auto.vercel.app/api/tg/serve'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    logger.info('TGWebhook', `Received: ${body.message?.text || 'callback'}`)

    const message = body.message
    const callback = body.callback_query

    if (callback) {
      // Handle callback queries from inline buttons
      const chatId = callback.message?.chat?.id
      const data = callback.data

      if (data === 'open_dashboard') {
        await sendTelegramMessage(chatId, 'Opening POLYAGENT Dashboard...', {
          reply_markup: {
            inline_keyboard: [[{
              text: 'Open Dashboard',
              web_app: { url: MINI_APP_URL }
            }]]
          }
        })
      }

      // Answer callback query to remove loading state
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callback.id })
      })

      return NextResponse.json({ ok: true })
    }

    if (!message || !message.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id
    const text = message.text.trim().toLowerCase()

    if (text === '/start') {
      await sendTelegramMessage(chatId,
        'POLYAGENT v8.3 — Autonomous Polymarket Trading\n\n' +
        'Commands:\n' +
        '/dashboard — Open trading dashboard\n' +
        '/status — Agent status & P&L\n' +
        '/markets — Top market opportunities\n' +
        '/trades — Recent trades\n' +
        '/help — Show all commands',
        {
          reply_markup: {
            inline_keyboard: [[{
              text: 'Open Dashboard',
              web_app: { url: MINI_APP_URL }
            }]]
          }
        }
      )
    } else if (text === '/dashboard' || text === '/d') {
      await sendTelegramMessage(chatId, 'POLYAGENT Dashboard', {
        reply_markup: {
          inline_keyboard: [[{
            text: 'Open Dashboard',
            web_app: { url: MINI_APP_URL }
          }]]
        }
      })
    } else if (text === '/status' || text === '/s') {
      // Fetch agent status from our own API
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      try {
        const res = await fetch(`${baseUrl}/api/agent`)
        const data = await res.json()
        const agent = data.state
        if (agent) {
          const pnl = agent.currentCapital - agent.capitalBase
          const pnlPct = ((pnl / agent.capitalBase) * 100).toFixed(1)
          const pnlEmoji = pnl >= 0 ? '+' : ''
          await sendTelegramMessage(chatId,
            `Agent Status: ${agent.status.toUpperCase()}\n\n` +
            `Capital: $${agent.currentCapital?.toFixed(2) || '—'}\n` +
            `P&L: ${pnlEmoji}$${pnl?.toFixed(2)} (${pnlEmoji}${pnlPct}%)\n` +
            `Trades: ${agent.totalTrades || 0}\n` +
            `Win Rate: ${((agent.winRate || 0) * 100).toFixed(1)}%\n` +
            `Sharpe: ${agent.sharpeRatio?.toFixed(2) || '—'}\n` +
            `Strategy: ${agent.currentStrategy || '—'}`
          )
        }
      } catch {
        await sendTelegramMessage(chatId, 'Agent data unavailable. Try /dashboard for live view.')
      }
    } else if (text === '/markets' || text === '/m') {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      try {
        const res = await fetch(`${baseUrl}/api/markets?limit=5`)
        const markets = await res.json()
        if (Array.isArray(markets) && markets.length > 0) {
          const lines = markets.slice(0, 5).map((m: any, i: number) => {
            const price = m.yesPrice ? `$${m.yesPrice.toFixed(2)}` : '—'
            const vol = m.volume ? `$${(m.volume / 1000).toFixed(1)}k vol` : ''
            return `${i + 1}. ${m.title?.slice(0, 50) || 'Unknown'}\n   ${price} · ${vol}`
          })
          await sendTelegramMessage(chatId, `Top Markets\n\n${lines.join('\n\n')}`)
        } else {
          await sendTelegramMessage(chatId, 'No market data available right now.')
        }
      } catch {
        await sendTelegramMessage(chatId, 'Market data unavailable. Try /dashboard.')
      }
    } else if (text === '/trades' || text === '/t') {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      try {
        const res = await fetch(`${baseUrl}/api/trades?limit=5`)
        const trades = await res.json()
        if (Array.isArray(trades) && trades.length > 0) {
          const lines = trades.slice(0, 5).map((t: any, i: number) => {
            const market = t.market?.title?.slice(0, 40) || 'Unknown'
            const side = t.side || '—'
            const size = t.size ? `$${t.size.toFixed(0)}` : '—'
            return `${i + 1}. ${market}\n   ${side} · ${size} @ $${t.price?.toFixed(2) || '—'}`
          })
          await sendTelegramMessage(chatId, `Recent Trades\n\n${lines.join('\n\n')}`)
        } else {
          await sendTelegramMessage(chatId, 'No recent trades.')
        }
      } catch {
        await sendTelegramMessage(chatId, 'Trade data unavailable. Try /dashboard.')
      }
    } else if (text === '/help' || text === '/h') {
      await sendTelegramMessage(chatId,
        'POLYAGENT Commands:\n\n' +
        '/dashboard — Full trading dashboard (mini app)\n' +
        '/status — Agent P&L and performance\n' +
        '/markets — Top market opportunities\n' +
        '/trades — Recent trade feed\n' +
        '/help — This message\n\n' +
        'Data refreshes every 15-30s in the mini app.'
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('TGWebhook', 'Webhook error', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}

async function sendTelegramMessage(chatId: number, text: string, extra?: Record<string, unknown>) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra,
    }),
  })
}

// GET for webhook setup verification
export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'POLYAGENT Telegram Webhook' })
}
