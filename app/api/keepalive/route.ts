import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/* Hit daily by a Vercel cron so the Supabase free-tier project keeps seeing
   activity and is not auto-paused after 7 idle days. Runs a tiny read. */
export async function GET() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('teams').select('id').limit(1)
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
