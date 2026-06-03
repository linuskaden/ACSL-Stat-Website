import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── In-memory rate limit store ─────────────────────────────────────────────
// Map<ip → { count, windowStart }>
// Works for single-instance deployments (Netlify/Vercel functions with warm
// instances). For multi-region serverless at scale, swap for Upstash Redis.
const store = new Map<string, { count: number; windowStart: number }>()
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now()
  const rec = store.get(ip)

  if (!rec || now - rec.windowStart >= WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now })
    return { allowed: true, retryAfterSec: 0 }
  }

  if (rec.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - rec.windowStart)) / 1000)
    return { allowed: false, retryAfterSec }
  }

  rec.count++
  return { allowed: true, retryAfterSec: 0 }
}

// ── POST /api/auth/login ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  const { allowed, retryAfterSec } = checkRateLimit(ip)

  if (!allowed) {
    const mins = Math.ceil(retryAfterSec / 60)
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    )
  }

  let body: { email?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { email, password } = body
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Successful login → clear the rate limit counter for this IP
  store.delete(ip)
  return NextResponse.json({ success: true })
}
