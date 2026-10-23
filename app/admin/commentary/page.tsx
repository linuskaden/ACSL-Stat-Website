import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CommentaryMatchView from '@/components/CommentaryMatchView'
import { getSelectedSeason } from '@/lib/season'
import { getSelectedCompetition } from '@/lib/competition'

export default async function CommentaryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const competition = await getSelectedCompetition()
  const season = await getSelectedSeason(competition)

  const [{ data: games }, { data: players }, { data: coaches }] = await Promise.all([
    supabase.from('games')
      .select('id,status,scheduled_at,stage,home_team:teams!games_home_team_id_fkey(*),away_team:teams!games_away_team_id_fkey(*)')
      .eq('competition_id', competition.id)
      .eq('season', season)
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null)
      .order('scheduled_at', { ascending: true, nullsFirst: false }),
    supabase.from('players').select('*').eq('competition_id', competition.id),
    supabase.from('coaches').select('*'),
  ])

  return (
    <div>
      <div className="h-16 flex items-center justify-between px-5 border-b border-black/10 dark:border-white/10 bg-white dark:bg-[#0d0d0d]">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-xs font-bold text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">← Admin</Link>
          <span className="text-sm font-black text-slate-900 dark:text-white">Kommentatoren-Tool</span>
        </div>
      </div>
      <CommentaryMatchView games={(games ?? []) as any} players={(players ?? []) as any} coaches={(coaches ?? []) as any} season={season} />
    </div>
  )
}
