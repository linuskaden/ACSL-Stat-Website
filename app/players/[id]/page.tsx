import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PlayerPageClient from '@/components/PlayerPageClient'

export const revalidate = 30

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: player } = await supabase
    .from('players')
    .select('*, team:teams(*)')
    .eq('id', id)
    .single()

  if (!player) notFound()

  const [{ data: career }, { data: statRows }] = await Promise.all([
    supabase
      .from('career_stats')
      .select('*')
      .eq('player_id', id)
      .order('season', { ascending: false }),
    supabase
      .from('game_stats')
      .select('*, game:games(id, season, game_type, status, scheduled_at, home_team_id, away_team_id, home_score, away_score, home_team:teams!games_home_team_id_fkey(id, short_name, slug, primary_color, logo_url), away_team:teams!games_away_team_id_fkey(id, short_name, slug, primary_color, logo_url))')
      .eq('player_id', id),
  ])

  const team = (player as any).team
  const teamId = (player as any).team_id

  // Aggregate game_stats (per quarter) into one stat line per game, with meta
  const byGame = new Map<string, any>()
  for (const row of (statRows ?? []) as any[]) {
    const g = row.game
    if (!g) continue
    if (!byGame.has(g.id)) byGame.set(g.id, { game: g, stats: {} as Record<string, number> })
    const acc = byGame.get(g.id).stats
    for (const [k, v] of Object.entries(row)) if (typeof v === 'number') acc[k] = (acc[k] ?? 0) + v
  }

  const gameLog = [...byGame.values()]
    .map(({ game, stats }) => {
      const isHome = game.home_team_id === teamId
      const opponent = isHome ? game.away_team : game.home_team
      const teamScore = isHome ? game.home_score : game.away_score
      const oppScore = isHome ? game.away_score : game.home_score
      const decided = game.status === 'final' && teamScore != null && oppScore != null
      const result = decided ? (teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'T') : null
      return {
        gameId: game.id,
        season: game.season,
        gameType: game.game_type,
        status: game.status,
        date: game.scheduled_at,
        opponent: opponent
          ? { short_name: opponent.short_name, slug: opponent.slug, logo_url: opponent.logo_url, primary_color: opponent.primary_color }
          : null,
        isHome,
        teamScore, oppScore, result,
        stats,
      }
    })
    .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href={`/teams/${team?.slug ?? ''}`} className="text-xs text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white mb-4 inline-flex items-center gap-1">
        ← {team?.name ?? 'Team'}
      </Link>

      <PlayerPageClient
        player={player as any}
        team={team}
        career={career ?? []}
        gameLog={gameLog}
      />
    </div>
  )
}
