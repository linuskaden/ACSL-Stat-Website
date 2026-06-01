import { createClient } from '@/lib/supabase/server'

export const revalidate = 30

const ROUND_ORDER = ['wildcard', 'semifinal', 'third_place', 'final']

const ROUND_LABEL: Record<string, string> = {
  wildcard:    'Playoffs',
  semifinal:   'Semifinals',
  third_place: '3rd Place',
  final:       'Final',
}

export default async function PlayoffsPage() {
  const supabase = await createClient()

  const [{ data: games }, { data: bracket }] = await Promise.all([
    supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
      .eq('season', 2026)
      .in('game_type', ROUND_ORDER)
      .order('scheduled_at', { nullsFirst: false }),
    supabase
      .from('playoff_bracket')
      .select('*')
      .eq('season', 2026),
  ])

  // Map game_id → bracket entry for seed + winner info
  const bracketByGameId: Record<string, any> = {}
  ;(bracket ?? []).forEach((b: any) => { if (b.game_id) bracketByGameId[b.game_id] = b })

  // Group by round in order
  const byRound: Record<string, any[]> = {}
  ;(games ?? []).forEach((g: any) => {
    if (!byRound[g.game_type]) byRound[g.game_type] = []
    byRound[g.game_type].push(g)
  })

  const hasAnyGame = Object.keys(byRound).length > 0

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black italic tracking-tight mb-1 text-slate-900 dark:text-white">Playoff Bracket 2026</h1>
      <p className="text-slate-500 dark:text-[#555] text-sm mb-8">
        Wildcard → Semifinals → 3rd Place / ACSL Summer Bowl
      </p>

      {!hasAnyGame && (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-8 text-center text-slate-500 dark:text-[#555] shadow-sm">
          Playoff bracket wird nach der Regular Season angezeigt.
        </div>
      )}

      <div className="space-y-8">
        {ROUND_ORDER.filter(r => byRound[r]?.length).map((round, roundIdx) => (
          <div key={round}>
            {/* Section divider */}
            {roundIdx > 0 && (
              <div className="flex items-center gap-3 mb-4">
                <div className="text-slate-300 dark:text-[#333] text-lg">↓</div>
              </div>
            )}

            <h2 className="text-[10px] font-bold tracking-widest text-slate-400 dark:text-[#555] uppercase mb-3">
              {ROUND_LABEL[round]}
            </h2>

            <div className="space-y-2">
              {byRound[round].map((game: any) => {
                const be = bracketByGameId[game.id]
                const winnerId = be?.winner_id ?? null
                const homeWon = winnerId === game.home_team_id
                const awayWon = winnerId === game.away_team_id
                const isFinal = game.status === 'final'
                const isLive  = game.status === 'live'
                const homeSeed: number | null = be?.home_seed ?? null
                const awaySeed: number | null = be?.away_seed ?? null

                return (
                  <div key={game.id}
                    className={`bg-white dark:bg-[#111] border rounded-xl overflow-hidden shadow-sm ${
                      round === 'final'       ? 'border-[#ff1d25]/30' :
                      round === 'third_place' ? 'border-[#f5a623]/20' :
                      isLive                  ? 'border-[#ff1d25]/40' :
                                               'border-black/[0.07] dark:border-white/5'
                    }`}>

                    {/* Game name banner (for named games) */}
                    {game.notes && (
                      <div className={`px-4 py-1.5 text-[10px] font-bold tracking-widest uppercase border-b ${
                        round === 'final' ? 'bg-[#ff1d25]/10 border-[#ff1d25]/20 text-[#ff1d25]' : 'bg-black/[0.03] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/5 text-[#f5a623]'
                      }`}>
                        {game.notes}
                      </div>
                    )}

                    {/* Home team row */}
                    <TeamRow
                      team={game.home_team}
                      seed={homeSeed}
                      score={isFinal || isLive ? game.home_score ?? 0 : null}
                      won={homeWon}
                      isTop
                    />

                    {/* Divider + meta */}
                    <div className="flex items-center border-t border-b border-black/[0.06] dark:border-white/[0.04] px-4 py-1.5 bg-black/[0.02] dark:bg-[#0d0d0d]">
                      <span className="text-[10px] text-slate-400 dark:text-[#333] font-bold tracking-widest uppercase mr-auto">
                        {isLive ? <span className="text-[#ff1d25] animate-pulse">● LIVE</span> :
                         isFinal ? <span className="text-[#04a550]">Final</span> :
                         'Upcoming'}
                      </span>
                      {game.scheduled_at && (
                        <span className="text-[11px] text-slate-400 dark:text-[#444]">
                          {new Date(game.scheduled_at).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          {' · '}
                          {new Date(game.scheduled_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* Away team row */}
                    <TeamRow
                      team={game.away_team}
                      seed={awaySeed}
                      score={isFinal || isLive ? game.away_score ?? 0 : null}
                      won={awayWon}
                      isTop={false}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TeamRow({ team, seed, score, won, isTop }: {
  team: any
  seed: number | null
  score: number | null
  won: boolean
  isTop: boolean
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${won ? 'bg-black/[0.03] dark:bg-white/[0.03]' : ''} ${!isTop ? '' : ''}`}>
      {/* Seed */}
      <span className="text-xs text-slate-400 dark:text-[#444] w-4 text-center font-mono shrink-0">
        {seed ?? ''}
      </span>

      {/* Logo */}
      {team?.logo_url ? (
        <img src={team.logo_url} alt="" className="w-7 h-7 object-contain shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded bg-black/5 dark:bg-white/5 shrink-0" />
      )}

      {/* Name */}
      <span className={`flex-1 text-sm font-semibold ${won ? 'text-slate-900 dark:text-white font-bold' : team ? 'text-slate-600 dark:text-[#aaa]' : 'text-slate-400 dark:text-[#444]'}`}>
        {team?.short_name ?? 'TBD'}
      </span>

      {/* Score */}
      {score !== null && (
        <span className={`text-lg font-black tabular-nums ${won ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[#666]'}`}>
          {score}
        </span>
      )}

      {/* Winner check */}
      {won && (
        <span className="text-[#04a550] text-sm font-bold shrink-0">✓</span>
      )}
    </div>
  )
}
