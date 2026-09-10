import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { competitionById } from '@/lib/competition'
import StatsTracker from '@/components/StatsTracker'
import BballTracker from '@/components/BballTracker'

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: game } = await supabase
    .from('games')
    .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
    .eq('id', id)
    .single()
  if (!game) notFound()

  const homeId = (game as any).home_team?.id
  const awayId = (game as any).away_team?.id
  const competitionId = (game as any).competition_id as string | null
  const sport = competitionById(competitionId)?.sport ?? 'football'

  const playerQuery = (teamId: string) => {
    let q = supabase.from('players').select('*').eq('team_id', teamId).eq('is_active', true)
    if (competitionId) q = q.eq('competition_id', competitionId)
    return q.order('jersey_number', { nullsFirst: false })
  }

  const statsTable = sport === 'basketball' ? 'bball_game_stats' : 'game_stats'

  const [{ data: homePlayers }, { data: awayPlayers }, { data: existingStats }] = await Promise.all([
    homeId ? playerQuery(homeId) : Promise.resolve({ data: [] as any[] }),
    awayId ? playerQuery(awayId) : Promise.resolve({ data: [] as any[] }),
    supabase.from(statsTable).select('*').eq('game_id', id),
  ])

  if (sport === 'basketball') {
    return (
      <BballTracker
        game={game as any}
        homePlayers={homePlayers ?? []}
        awayPlayers={awayPlayers ?? []}
        initialStats={existingStats ?? []}
      />
    )
  }

  return (
    <StatsTracker
      game={game as any}
      homePlayers={homePlayers ?? []}
      awayPlayers={awayPlayers ?? []}
      initialStats={existingStats ?? []}
    />
  )
}
