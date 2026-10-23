import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminRosterIndex() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: teams } = await supabase.from('teams').select('slug').order('name', { ascending: true }).limit(1)
  const slug = teams?.[0]?.slug
  redirect(slug ? `/admin/roster/${slug}` : '/admin')
}
