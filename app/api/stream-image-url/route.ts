import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/* Returns a short-lived signed URL for the CURRENTLY active stream image.
   The bucket is private; the public (anonymous) overlay can't sign URLs
   itself, so this server route does it with the service-role key — and only
   ever signs whatever the operator has set as the active image, never an
   arbitrary path. Requires SUPABASE_SERVICE_ROLE_KEY in the server env
   (set it in Vercel → Project Settings → Environment Variables). */

export const dynamic = 'force-dynamic'

const SIGNED_TTL = 60 * 60 * 4 // 4 hours — covers a full broadcast session
const noStore = { 'cache-control': 'no-store' }

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ url: null, error: 'service key not configured' }, { headers: noStore })
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data: state } = await sb
    .from('stream_overlay_state').select('mode, image_path').eq('id', 1).single()

  if (!state || state.mode !== 'image' || !state.image_path) {
    return NextResponse.json({ url: null }, { headers: noStore })
  }

  const { data: signed } = await sb.storage
    .from('stream-images').createSignedUrl(state.image_path as string, SIGNED_TTL)

  return NextResponse.json({ url: signed?.signedUrl ?? null }, { headers: noStore })
}
