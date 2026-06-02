import { createClient } from '@/lib/supabase/server'

export const revalidate = 30

const ROUND_ORDER = ['wildcard', 'semifinal', 'third_place', 'final']

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

  // Group by round (each list already ordered by scheduled_at)
  const byRound: Record<string, any[]> = {}
  ;(games ?? []).forEach((g: any) => {
    if (!byRound[g.game_type]) byRound[g.game_type] = []
    byRound[g.game_type].push(g)
  })

  const wildcard   = byRound['wildcard']   ?? []
  const semifinal  = byRound['semifinal']  ?? []
  const finalGame  = (byRound['final'] ?? [])[0] ?? null
  const thirdPlace = (byRound['third_place'] ?? [])[0] ?? null

  const hasAnyGame = (games ?? []).length > 0

  // Order wildcard games so wildcard[i] visually feeds semifinal[i].
  // A semifinal's away slot is fed by the wildcard winner sharing that away seed.
  const orderedWildcard = semifinal
    .map((semi) => {
      const seed = bracketByGameId[semi.id]?.away_seed
      return wildcard.find((w) => {
        const wbe = bracketByGameId[w.id]
        return wbe && (wbe.home_seed === seed || wbe.away_seed === seed)
      })
    })
    .filter(Boolean) as any[]

  const wcCol = orderedWildcard.length === wildcard.length ? orderedWildcard : wildcard
  const showBracket = semifinal.length === 2 && wcCol.length === 2

  // Champion (winner of the final), if decided
  const finalBe = finalGame ? bracketByGameId[finalGame.id] : null
  const champTeam =
    finalGame && finalBe?.winner_id
      ? finalBe.winner_id === finalGame.home_team_id
        ? finalGame.home_team
        : finalGame.away_team
      : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black italic tracking-tight mb-1 text-slate-900 dark:text-white">Playoff Bracket 2026</h1>
      <p className="text-slate-500 dark:text-[#555] text-sm mb-8">
        Wildcard → Semifinals → ACSL Summer Bowl
      </p>

      {!hasAnyGame && (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-8 text-center text-slate-500 dark:text-[#555] shadow-sm">
          Playoff bracket wird nach der Regular Season angezeigt.
        </div>
      )}

      {hasAnyGame && showBracket && (
        <div className="pf-scroll">
          <div className="pf-inner">
            {/* Column headers */}
            <div className="pf-heads">
              <div className="pf-head">Wildcard</div>
              <div className="pf-head--gap" />
              <div className="pf-head">Semifinals</div>
              <div className="pf-head--gap" />
              <div className="pf-head">Final &amp; 3rd</div>
              <div className="pf-head--gap" />
              <div className="pf-head pf-head--champ">Champion</div>
            </div>

            {/* Bracket */}
            <div className="pf-bracket">
              {/* Wildcard */}
              <div className="pf-col">
                {wcCol.map((g) => <MatchBox key={g.id} game={g} be={bracketByGameId[g.id]} />)}
              </div>

              {/* feed connectors */}
              <div className="pf-conn pf-conn--feed">
                <span className="pf-line h-top" />
                <span className="pf-line h-bot" />
              </div>

              {/* Semifinals */}
              <div className="pf-col">
                {semifinal.map((g) => <MatchBox key={g.id} game={g} be={bracketByGameId[g.id]} />)}
              </div>

              {/* merge connectors — winners → final (top), losers → 3rd place (bottom, bronze) */}
              <div className="pf-conn pf-conn--merge">
                <span className="pf-line h-up" />
                <span className="pf-line h-dn" />
                <span className="pf-line v" />
                <span className="pf-line h-win" />
                <span className="pf-line h-los pf-line--bronze" />
              </div>

              {/* Final (top) + 3rd place (bottom) */}
              <div className="pf-col">
                {finalGame
                  ? <MatchBox game={finalGame} be={finalBe} highlight title={finalGame.notes || 'Final'} />
                  : <PlaceholderBox label="Final" />}
                {thirdPlace
                  ? <MatchBox game={thirdPlace} be={bracketByGameId[thirdPlace.id]} accent="bronze" title="3rd Place" />
                  : <PlaceholderBox label="3rd Place" />}
              </div>

              {/* single connector */}
              <div className="pf-conn pf-conn--single">
                <span className="pf-line h-mid" />
              </div>

              {/* Champion (aligned to final) */}
              <div className="pf-col pf-col--champ">
                <ChampionBox team={champTeam} />
                <div className="pf-champ-spacer" aria-hidden />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fallback: unexpected bracket shape → simple stacked list */}
      {hasAnyGame && !showBracket && (
        <div className="space-y-6">
          {ROUND_ORDER.filter((r) => byRound[r]?.length).map((round) => (
            <div key={round}>
              <h2 className="text-[10px] font-bold tracking-widest text-slate-400 dark:text-[#555] uppercase mb-3">
                {round.replace('_', ' ')}
              </h2>
              <div className="space-y-3 max-w-sm">
                {byRound[round].map((g) => <MatchBox key={g.id} game={g} be={bracketByGameId[g.id]} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Match box: two team rows + meta label ── */
function MatchBox({ game, be, highlight, accent, title }: {
  game: any
  be: any
  highlight?: boolean
  accent?: 'bronze'
  title?: string
}) {
  const winnerId = be?.winner_id ?? null
  const homeWon = winnerId != null && winnerId === game.home_team_id
  const awayWon = winnerId != null && winnerId === game.away_team_id
  const isFinal = game.status === 'final'
  const isLive  = game.status === 'live'

  const border =
    isLive            ? 'border-[#ff1d25]/40' :
    accent === 'bronze' ? 'border-[#f5a623]/30' :
    highlight         ? 'border-[#ff1d25]/30' :
                        'border-black/[0.08] dark:border-white/10'

  const leftText = title ?? (isLive ? '● LIVE' : isFinal ? 'Final' : 'Upcoming')
  const leftColor = title
    ? (accent === 'bronze' ? 'text-[#f5a623]' : highlight ? 'text-[#ff1d25]' : 'text-slate-500 dark:text-[#888]')
    : (isLive ? 'text-[#ff1d25]' : isFinal ? 'text-[#04a550]' : 'text-slate-400 dark:text-[#666]')

  return (
    <div className={`pf-match rounded-lg border bg-white dark:bg-[#111] shadow-sm overflow-hidden ${border}`}>
      {/* meta */}
      <div className="flex items-center justify-between px-2.5 py-1 border-b border-black/[0.06] dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]">
        <span className={`text-[9px] font-bold uppercase tracking-wider truncate ${leftColor}`}>
          {leftText}
        </span>
        {game.scheduled_at && (
          <span className="text-[10px] text-slate-400 dark:text-[#555] font-medium tabular-nums">
            {new Date(game.scheduled_at).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })}
            {' · '}
            {new Date(game.scheduled_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <TeamLine team={game.home_team} seed={be?.home_seed ?? null} score={isFinal || isLive ? game.home_score ?? 0 : null} won={homeWon} />
      <div className="h-px bg-black/[0.06] dark:bg-white/10" />
      <TeamLine team={game.away_team} seed={be?.away_seed ?? null} score={isFinal || isLive ? game.away_score ?? 0 : null} won={awayWon} />
    </div>
  )
}

function TeamLine({ team, seed, score, won }: {
  team: any
  seed: number | null
  score: number | null
  won: boolean
}) {
  return (
    <div className={`flex items-center gap-2 px-2.5 h-8 ${won ? 'bg-black/[0.03] dark:bg-white/[0.04]' : ''}`}>
      <span className="w-3 text-center text-[10px] font-mono text-slate-400 dark:text-[#555] shrink-0">{seed ?? ''}</span>
      {team?.logo_url
        ? <img src={team.logo_url} alt="" className="w-5 h-5 object-contain shrink-0" />
        : <div className="w-5 h-5 rounded bg-black/5 dark:bg-white/5 shrink-0" />}
      <span className={`flex-1 truncate text-xs ${
        won ? 'font-bold text-slate-900 dark:text-white'
            : team ? 'font-medium text-slate-600 dark:text-[#aaa]'
                   : 'text-slate-400 dark:text-[#555]'
      }`}>
        {team?.short_name ?? 'TBD'}
      </span>
      {score !== null && (
        <span className={`text-sm font-black tabular-nums ${won ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[#666]'}`}>
          {score}
        </span>
      )}
      {won && <span className="text-[#04a550] text-xs font-bold shrink-0">✓</span>}
    </div>
  )
}

function PlaceholderBox({ label }: { label: string }) {
  return (
    <div className="pf-match rounded-lg border border-dashed border-black/15 dark:border-white/15 bg-white/50 dark:bg-white/[0.02] h-[86px] flex items-center justify-center text-xs text-slate-400 dark:text-[#555]">
      {label} TBD
    </div>
  )
}

function ChampionBox({ team }: { team: any }) {
  return (
    <div className="h-[124px] rounded-xl border-2 border-[#ff1d25]/40 bg-[#ff1d25]/[0.05] shadow-sm px-3 flex flex-col items-center justify-center text-center">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff1d25" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-1.5">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
      <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#ff1d25] mb-1">Champion</div>
      {team?.logo_url && <img src={team.logo_url} alt="" className="w-8 h-8 object-contain mx-auto mb-1" />}
      <div className={`text-sm font-black ${team ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-[#555]'}`}>
        {team?.short_name ?? 'TBD'}
      </div>
    </div>
  )
}
