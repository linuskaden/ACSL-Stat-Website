import { createClient } from '@/lib/supabase/server'
import TeamBadge from '@/components/TeamBadge'
import type { GameWithTeams } from '@/lib/supabase/types'
import { getSelectedSeason } from '@/lib/season'

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

export default async function SchedulePage() {
  const supabase = await createClient()
  const season = await getSelectedSeason()
  const { data: games } = await supabase
    .from('games')
    .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
    .eq('season', season)
    .order('scheduled_at', { nullsFirst: false })

  const grouped: Record<string, GameWithTeams[]> = {}
  ;(games ?? []).forEach((g: any) => {
    const key = GAME_TYPE_LABELS[g.game_type] ?? g.game_type
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(g)
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black italic tracking-tight mb-6 text-slate-900 dark:text-white">Schedule &amp; Results <span className="text-slate-400 dark:text-[#7a7a7a] font-bold not-italic text-2xl">{season}</span></h1>

      {Object.keys(grouped).length === 0 && (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-8 text-center text-slate-500 dark:text-[#7a7a7a] shadow-sm">
          No games scheduled yet.
        </div>
      )}

      {Object.entries(grouped).map(([type, typeGames]) => (
        <div key={type} className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-3">{type}</h2>
          <div className="space-y-2">
            {typeGames.map((game: any) => {
              const status = STATUS_LABELS[game.status] ?? STATUS_LABELS.scheduled
              const isFinal = game.status === 'final'
              const isLive = game.status === 'live'
              return (
                <div key={game.id}
                  className={`bg-white dark:bg-[#111] border rounded-xl p-4 flex items-center gap-4 shadow-sm ${isLive ? 'border-[#ff1d25]/40' : 'border-black/[0.07] dark:border-white/5'}`}>
                  {/* Date */}
                  <div className="w-16 text-center shrink-0">
                    {game.scheduled_at ? (
                      <>
                        <div className="text-xs text-slate-500 dark:text-[#7a7a7a]">
                          {new Date(game.scheduled_at).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-[#7a7a7a]">
                          {new Date(game.scheduled_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </>
                    ) : <span className="text-xs text-slate-400 dark:text-[#7a7a7a]">TBD</span>}
                  </div>

                  {/* Teams & Score */}
                  <div className="flex-1 flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      {game.home_team && <TeamBadge team={game.home_team} size="sm" />}
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">{game.home_team?.short_name ?? '—'}</span>
                    </div>

                    <div className="text-center min-w-[80px]">
                      {isFinal || isLive ? (
                        <div className="font-black text-xl text-slate-900 dark:text-white">
                          {game.home_score ?? 0}
                          <span className="text-slate-400 dark:text-[#7a7a7a] mx-1">–</span>
                          {game.away_score ?? 0}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-[#7a7a7a] text-xs">vs</span>
                      )}
                      <div className="text-xs font-semibold" style={{ color: status.color }}>
                        {isLive && <span className="animate-pulse mr-1">●</span>}
                        {status.label}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-semibold text-sm text-slate-900 dark:text-white">{game.away_team?.short_name ?? '—'}</span>
                      {game.away_team && <TeamBadge team={game.away_team} size="sm" />}
                    </div>
                  </div>

                  {/* Location */}
                  {game.location && (
                    <div className="text-xs text-slate-400 dark:text-[#7a7a7a] hidden md:block shrink-0 w-24 truncate text-right">
                      {game.location}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
