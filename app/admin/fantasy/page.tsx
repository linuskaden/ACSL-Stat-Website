import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSelectedCompetition } from '@/lib/competition'
import { getSelectedSeason } from '@/lib/season'
import { isAdminEmail } from '@/lib/admin'
import FantasyAdminClient from '@/components/fantasy/FantasyAdminClient'
import { setRoundStatus, setLockAt, addGameToRound, removeGameFromRound } from './actions'

type GameRow = {
  id: string; scheduled_at: string | null; status: string
  home_score: number | null; away_score: number | null
  home_team: { short_name: string | null; name: string | null } | null
  away_team: { short_name: string | null; name: string | null } | null
}

export default async function AdminFantasyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')
  if (!isAdminEmail(user.email)) redirect('/admin')

  const competition = await getSelectedCompetition()
  const season = await getSelectedSeason(competition)

  const [{ data: rounds }, { data: links }, { data: gamesData }] = await Promise.all([
    supabase.from('fantasy_rounds')
      .select('id,name,status,lock_at,sort_order')
      .eq('competition_id', competition.id).eq('season', season)
      .order('sort_order'),
    supabase.from('fantasy_round_games').select('round_id,game_id'),
    supabase.from('games')
      .select('id,scheduled_at,status,home_score,away_score,home_team:teams!games_home_team_id_fkey(short_name,name),away_team:teams!games_away_team_id_fkey(short_name,name)')
      .eq('competition_id', competition.id).eq('season', season)
      .order('scheduled_at', { ascending: true, nullsFirst: false }),
  ])

  const games = (gamesData ?? []) as unknown as GameRow[]
  const shape = (g: GameRow) => ({
    id: g.id,
    home: g.home_team?.short_name || g.home_team?.name || '?',
    away: g.away_team?.short_name || g.away_team?.name || '?',
    scheduled_at: g.scheduled_at,
    status: g.status,
    score: g.home_score != null && g.away_score != null ? `${g.home_score}:${g.away_score}` : null,
  })
  const gameById = new Map(games.map(g => [g.id, shape(g)]))

  const linkRows = (links ?? []) as { round_id: string; game_id: string }[]
  const assigned = new Set(linkRows.map(l => l.game_id))
  const gamesByRound: Record<string, ReturnType<typeof shape>[]> = {}
  for (const l of linkRows) {
    const g = gameById.get(l.game_id)
    if (!g) continue
    ;(gamesByRound[l.round_id] ??= []).push(g)
  }
  const availableGames = games.filter(g => !assigned.has(g.id)).map(shape)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-xs font-bold text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">← Admin</Link>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Fantasy</h1>
        </div>
        <Link href="/fantasy" target="_blank" className="text-xs font-bold text-[#16163f] dark:text-white">Fantasy öffnen ↗</Link>
      </div>

      <FantasyAdminClient
        rounds={(rounds ?? []) as never}
        gamesByRound={gamesByRound}
        availableGames={availableGames}
        onSetStatus={setRoundStatus}
        onSetLock={setLockAt}
        onAddGame={addGameToRound}
        onRemoveGame={removeGameFromRound}
      />
    </div>
  )
}
