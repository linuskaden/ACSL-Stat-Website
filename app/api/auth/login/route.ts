import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Rate limiting ───────────────────────────────────────────────────────────
// Uses Upstash Redis (sliding window) when env vars are present — works
// reliably across all serverless instances / cold starts.
// Falls back to a local in-memory Map for dev environments without Redis.

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5

// --- Upstash path (production) ---
async function upstashCheck(ip: string): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const { Ratelimit } = await import('@upstash/ratelimit')
  const { Redis } = await import('@upstash/redis')
  const rl = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(MAX_ATTEMPTS, '15 m'),
    prefix: 'acsl:login',
  })
  const { success, reset } = await rl.limit(ip)
  const retryAfterSec = success ? 0 : Math.ceil((reset - Date.now()) / 1000)
  return { allowed: success, retryAfterSec }
}

// --- In-memory fallback (dev / no Redis) ---
const memStore = new Map<string, { count: number; windowStart: number }>()
function memCheck(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now()
  const rec = memStore.get(ip)
  if (!rec || now - rec.windowStart >= WINDOW_MS) {
    memStore.set(ip, { count: 1, windowStart: now })
    return { allowed: true, retryAfterSec: 0 }
  }
  if (rec.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - rec.windowStart)) / 1000)
    return { allowed: false, retryAfterSec }
  }
  rec.count++
  return { allowed: true, retryAfterSec: 0 }
}

async function rateLimit(ip: string) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return upstashCheck(ip)
  }
  return memCheck(ip)
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

// ── POST /api/auth/login ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Reject oversized payloads (>1 KB is way more than email+password need)
  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  const ip = clientIp(request)
  const { allowed, retryAfterSec } = await rateLimit(ip)

  if (!allowed) {
    const mins = Math.ceil(retryAfterSec / 60)
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    )
  }

  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 254) : null
  const password = typeof body.password === 'string' ? body.password.slice(0, 128) : null

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  if (typeof memStore.delete === 'function') memStore.delete(ip)
  return NextResponse.json({ success: true })
}
