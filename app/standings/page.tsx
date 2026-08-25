import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason } from '@/lib/season'
import StandingsTable from '@/components/StandingsTable'
import { computeForm } from '@/lib/records'
import type { StandingsWithTeam } from '@/lib/supabase/types'

export const revalidate = 30

export default async function StandingsPage() {
  const supabase = await createClient()
  const season = await getSelectedSeason()

  const [{ data: standings }, { data: games }] = await Promise.all([
    supabase
      .from('standings')
      .select('*, team:teams(*)')
      .eq('season', season)
      .order('wins', { ascending: false }),
    supabase
      .from('games')
      .select('home_team_id, away_team_id, home_score, away_score, status, game_type, scheduled_at')
      .eq('season', season)
      .eq('game_type', 'regular_season'),
  ])

  const formByTeam = computeForm(games ?? [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <StandingsTable
        standings={(standings ?? []) as StandingsWithTeam[]}
        formByTeam={formByTeam}
      />
    </div>
  )
}
