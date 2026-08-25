import { createClient } from '@/lib/supabase/server'
import TeamBadge from '@/components/TeamBadge'
import ScheduleTabs from '@/components/ScheduleTabs'
import PlayoffBracket from '@/components/PlayoffBracket'
import Link from 'next/link'
import { getSelectedSeason } from '@/lib/season'
import { computeRecords } from '@/lib/records'

export const revalidate = 30

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Upcoming', color: '#7a7a7a' },
  live: { label: 'LIVE', color: '#ff1d25' },
  final: { label: 'Final', color: '#04a550' },
}

const GAME_TYPE_LABELS: Record<string, string> = {
  regular_season: 'Regular Season',
  wildcard: 'Wildcard',
  semifinal: 'Semifinal',
  third_place: 'Spiel um Platz 3',
  final: 'Championship',
}

const PLAYOFF_TYPES = ['wildcard', 'semifinal', 'third_place', 'final']

type StageGroup = { stage: string; date: string | null; city: string | null; venue: string | null; games: any[] }

function groupByStage(games: any[]): StageGroup[] {
  const groups: StageGroup[] = []
  const index = new Map<string, StageGroup>()
  for (const g of games) {
    const dateKey = g.scheduled_at ? new Date(g.scheduled_at).toISOString().slice(0, 10) : 'tbd'
    const stage = g.stage || GAME_TYPE_LABELS[g.game_type] || g.game_type
    const key = `${stage}__${dateKey}`
    if (!index.has(key)) {
      const grp: StageGroup = { stage, date: g.scheduled_at, city: g.city, venue: g.location, games: [] }
      index.set(key, grp)
      groups.push(grp)
    }
    index.get(key)!.games.push(g)
  }
  return groups
}

function GameList({ games, gamesWithStats, recordByTeam }: {
  games: any[]; gamesWithStats: Set<string>; recordByTeam: Record<string, string>
}) {
  const groups = groupByStage(games)
  if (groups.length === 0) {
    return (
      <div className="max-w-3xl mx-auto bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-8 text-center text-slate-500 dark:text-[#7a7a7a] shadow-sm">
        Noch keine Spiele angesetzt.
      </div>
    )
  }
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {groups.map((grp, gi) => (
        <div key={gi}>
          {/* Matchday header */}
          <div className="mb-3">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{grp.stage}</h2>
            <div className="text-xs text-slate-500 dark:text-[#7a7a7a] mt-0.5">
              {grp.date && new Date(grp.date).toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
              {grp.city && <> · {grp.city}</>}
              {grp.venue && <> · {grp.venue}</>}
            </div>
          </div>

          <div className="space-y-2">
            {grp.games.map((game: any) => {
              const status = STATUS_LABELS[game.status] ?? STATUS_LABELS.scheduled
              const isFinal = game.status === 'final'
              const isLive = game.status === 'live'
              const bothTeams = game.home_team && game.away_team
              return (
                <div key={game.id}
                  className={`bg-white dark:bg-[#111] border rounded-xl p-4 flex items-center gap-4 shadow-sm ${isLive ? 'border-[#ff1d25]/40' : 'border-black/[0.07] dark:border-white/5'}`}>
                  {/* Kickoff */}
                  <div className="w-14 text-center shrink-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                      {game.scheduled_at
                        ? new Date(game.scheduled_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
                        : 'TBD'}
                    </div>
                  </div>

                  {/* Matchup */}
                  {bothTeams ? (
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <TeamBadge team={game.home_team} size="sm" />
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">{game.home_team?.short_name ?? '—'}</span>
                        <span className="text-[11px] text-slate-400 dark:text-[#7a7a7a] tabular-nums">{recordByTeam[game.home_team_id] ?? '0-0'}</span>
                      </div>
                      <div className="text-center min-w-[76px]">
                        {isFinal || isLive ? (
                          <div className="font-black text-lg text-slate-900 dark:text-white">
                            {game.home_score ?? 0}<span className="text-slate-400 dark:text-[#7a7a7a] mx-1">–</span>{game.away_score ?? 0}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-[#7a7a7a] text-xs">vs</span>
                        )}
                        <div className="text-xs font-semibold" style={{ color: status.color }}>
                          {isLive && <span className="animate-pulse mr-1">●</span>}{status.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-[11px] text-slate-400 dark:text-[#7a7a7a] tabular-nums">{recordByTeam[game.away_team_id] ?? '0-0'}</span>
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">{game.away_team?.short_name ?? '—'}</span>
                        <TeamBadge team={game.away_team} size="sm" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 text-center font-bold text-sm text-slate-700 dark:text-[#bbb]">
                      {game.notes ?? 'TBD'}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    {/* Live → live view (greyed unless the game is live) */}
                    {isLive ? (
                      <Link href="/live"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#ff1d25] text-white text-xs font-bold hover:bg-[#e0181f] transition-colors">
                        <span className="animate-pulse">●</span> Live
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] text-slate-300 dark:text-[#555] text-xs font-semibold cursor-not-allowed select-none">
                        ● Live
                      </span>
                    )}

                    {/* Highlights — only for finished games (greyed if no link yet) */}
                    {isFinal && (
                      game.highlights_url ? (
                        <a href={game.highlights_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-slate-700 dark:text-white text-xs font-semibold hover:bg-black/[0.08] dark:hover:bg-white/[0.12] transition-colors">
                          Highlights
                        </a>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] text-slate-300 dark:text-[#555] text-xs font-semibold cursor-not-allowed select-none">
                          Highlights
                        </span>
                      )
                    )}

                    {/* Box score */}
                    {gamesWithStats.has(game.id) ? (
                      <Link href={`/games/${game.id}`}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#ff1d25]/10 text-[#ff1d25] text-xs font-semibold hover:bg-[#ff1d25]/20 transition-colors">
                        Box Score
                      </Link>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] text-slate-300 dark:text-[#555] text-xs font-semibold cursor-not-allowed select-none">
                        Box Score
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function SchedulePage() {
  const supabase = await createClient()
  const season = await getSelectedSeason()

  const [{ data: games }, { data: bracket }] = await Promise.all([
    supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
      .eq('season', season)
      .order('scheduled_at', { nullsFirst: false }),
    supabase.from('playoff_bracket').select('*').eq('season', season),
  ])

  const allGames = (games ?? []) as any[]
  const gameIds = allGames.map(g => g.id as string)
  const { data: statsRows } = gameIds.length > 0
    ? await supabase.from('game_stats').select('game_id').in('game_id', gameIds)
    : { data: [] as any[] }
  const gamesWithStats = new Set((statsRows ?? []).map((r: any) => r.game_id as string))

  const regularGames = allGames.filter(g => g.game_type === 'regular_season')
  const playoffGames = allGames.filter(g => PLAYOFF_TYPES.includes(g.game_type))

  // Team record — REGULAR SEASON final games only
  const recordByTeam = computeRecords(allGames)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <ScheduleTabs
        regular={<GameList games={regularGames} gamesWithStats={gamesWithStats} recordByTeam={recordByTeam} />}
        playoffs={<GameList games={playoffGames} gamesWithStats={gamesWithStats} recordByTeam={recordByTeam} />}
        bracket={<PlayoffBracket games={playoffGames} bracket={bracket ?? []} season={season} />}
      />
    </div>
  )
}
