import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import TeamRosterGrid from '@/components/TeamRosterGrid'
import { getSelectedSeason } from '@/lib/season'

export default async function AdminRosterPage({ params }: { params: Promise<{ team: string }> }) {
  const { team: slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const season = await getSelectedSeason()

  const { data: team } = await supabase.from('teams').select('*').eq('slug', slug).single()
  if (!team) notFound()

  const [{ data: players }, { data: allTeams }] = await Promise.all([
    supabase.from('players').select('*').eq('team_id', team.id)
      .order('is_active', { ascending: false })
      .order('jersey_number', { ascending: true, nullsFirst: false }),
    supabase.from('teams').select('*').order('name', { ascending: true }),
  ])

  return (
    <div>
      <div className="h-16 flex items-center justify-between px-5 border-b border-black/10 dark:border-white/10 bg-white dark:bg-[#0d0d0d]">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-xs font-bold text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">← Admin</Link>
          <span className="text-sm font-black text-slate-900 dark:text-white">Team Rosters</span>
          <span className="text-xs text-slate-400 dark:text-[#555]">· {team.name}</span>
        </div>
      </div>
      <TeamRosterGrid
        team={team as any}
        players={(players ?? []) as any}
        allTeams={(allTeams ?? []) as any}
        season={season}
        basePath="/admin/roster"
      />
    </div>
  )
}
