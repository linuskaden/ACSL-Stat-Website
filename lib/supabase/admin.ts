import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. SERVER-ONLY: never import this from a
// client component. Use exclusively inside admin-gated server actions after
// verifying the caller is an admin (see lib/admin.ts).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
