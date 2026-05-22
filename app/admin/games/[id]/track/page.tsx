import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import StatsTracker from '@/components/StatsTracker'

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

  const [{ data: homePlayers }, { data: awayPlayers }, { data: existingStats }] = await Promise.all([
    homeId ? supabase.from('players').select('*').eq('team_id', homeId).eq('is_active', true).order('jersey_number', { nullsFirst: false }) : { data: [] },
    awayId ? supabase.from('players').select('*').eq('team_id', awayId).eq('is_active', true).order('jersey_number', { nullsFirst: false }) : { data: [] },
    supabase.from('game_stats').select('*').eq('game_id', id),
  ])

  return (
    <StatsTracker
      game={game as any}
      homePlayers={homePlayers ?? []}
      awayPlayers={awayPlayers ?? []}
      initialStats={existingStats ?? []}
    />
  )
}
