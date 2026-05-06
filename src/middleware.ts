import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/request'

// Simple in-memory rate limit store
// Note: This only works per-instance. In a distributed prod env, use Redis.
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS = 60 // 60 requests per minute

export function middleware(request: NextRequest) {
  const ip = request.ip || 'unknown'
  const path = request.nextUrl.pathname

  // Only rate limit API routes
  if (path.startsWith('/api')) {
    const now = Date.now()
    const record = rateLimitStore.get(ip)

    if (!record || now > record.resetTime) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    } else {
      record.count++
      if (record.count > MAX_REQUESTS) {
        return new NextResponse(
          JSON.stringify({ error: 'Too many requests' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil((record.resetTime - now) / 1000).toString(),
            },
          }
        )
      }
    }
  }

  // Handle CORS
  const response = NextResponse.next()
  
  // In production, you should restrict this to your specific domain
  const origin = request.headers.get('origin')
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Max-Age', '86400')

  return response
}

export const config = {
  matcher: '/api/:path*',
}
