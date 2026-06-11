import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BroadcastMonitor from '@/components/BroadcastMonitor'

export const metadata = { title: 'ACSL Broadcast' }

export default async function BroadcastPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  return <BroadcastMonitor />
}
