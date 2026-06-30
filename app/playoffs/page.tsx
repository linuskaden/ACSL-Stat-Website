import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason } from '@/lib/season'

export const revalidate = 30

const ROUND_ORDER = ['wildcard', 'semifinal', 'third_place', 'final']

export default async function PlayoffsPage() {
  const supabase = await createClient()
  const season = await getSelectedSeason()

  const [{ data: games }, { data: bracket }] = await Promise.all([
    supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
      .eq('season', season)
      .in('game_type', ROUND_ORDER)
      .order('scheduled_at', { nullsFirst: false }),
    supabase
      .from('playoff_bracket')
      .select('*')
      .eq('season', season),
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

  // Carry-through connector colours = the winning team's colour for each feed
  const lc = (g: any) => (g ? lineColor(winnerColorOf(g, bracketByGameId[g.id])) : null)
  const wcTopColor = lc(wcCol[0])
  const wcBotColor = lc(wcCol[1])
  const sfTopColor = lc(semifinal[0])
  const sfBotColor = lc(semifinal[1])
  const champLineColor = finalGame ? lineColor(winnerColorOf(finalGame, finalBe)) : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black italic tracking-tight mb-1 text-slate-900 dark:text-white">Playoff Bracket {season}</h1>
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
                <span className="pf-line h-top" style={lineBg(wcTopColor)} />
                <span className="pf-line h-bot" style={lineBg(wcBotColor)} />
              </div>

              {/* Semifinals */}
              <div className="pf-col">
                {semifinal.map((g) => <MatchBox key={g.id} game={g} be={bracketByGameId[g.id]} />)}
              </div>

              {/* merge connectors — winners → final (top), losers → 3rd place (bottom, bronze) */}
              <div className="pf-conn pf-conn--merge">
                <span className="pf-line h-up" style={lineBg(sfTopColor)} />
                <span className="pf-line h-dn" style={lineBg(sfBotColor)} />
                <span className="pf-line v" style={lineBg(champLineColor)} />
                <span className="pf-line h-win" style={lineBg(champLineColor)} />
                <span className="pf-line h-los pf-line--bronze" />
              </div>

              {/* Final (top) + 3rd place (bottom) */}
              <div className="pf-col">
                {finalGame
                  ? <MatchBox game={finalGame} be={finalBe} highlight title={finalGame.notes || 'ACSL Summer Bowl'} />
                  : <PlaceholderBox label="Final" />}
                {thirdPlace
                  ? <MatchBox game={thirdPlace} be={bracketByGameId[thirdPlace.id]} accent="bronze" title="3rd Place" />
                  : <PlaceholderBox label="3rd Place" />}
              </div>

              {/* single connector */}
              <div className="pf-conn pf-conn--single">
                <span className="pf-line h-mid" style={lineBg(champLineColor)} />
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

/* ── Colour helpers ── */
function lum(hex: string): number {
  const h = (hex || '').replace('#', '')
  if (h.length < 6) return 0.5
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}
// Contrast text colour on a coloured bar
function textOn(hex: string): string { return lum(hex) > 0.6 ? '#0b0e1a' : '#ffffff' }
// Lighten near-black colours so a thin connector line stays visible
function lineColor(hex: string | null): string | null {
  if (!hex) return null
  if (lum(hex) > 0.13) return hex
  const h = hex.replace('#', '')
  const f = (x: number) => Math.round(x + (255 - x) * 0.55).toString(16).padStart(2, '0')
  return `#${f(parseInt(h.slice(0, 2), 16))}${f(parseInt(h.slice(2, 4), 16))}${f(parseInt(h.slice(4, 6), 16))}`
}
function winnerColorOf(game: any, be: any): string | null {
  if (!game || !be?.winner_id) return null
  const t = be.winner_id === game.home_team_id ? game.home_team : game.away_team
  return t?.primary_color ?? null
}
function lineBg(c: string | null): { background: string } | undefined { return c ? { background: c } : undefined }

/* ── Match box: two coloured team bars; the loser is dimmed ── */
function MatchBox({ game, be, highlight, title }: {
  game: any
  be: any
  highlight?: boolean
  accent?: 'bronze'
  title?: string
}) {
  const winnerId = be?.winner_id ?? null
  const decided  = winnerId != null
  const isFinal  = game.status === 'final'
  const isLive   = game.status === 'live'
  const showScore = isFinal || isLive
  const homeState = !decided ? 'neutral' : winnerId === game.home_team_id ? 'win' : 'lose'
  const awayState = !decided ? 'neutral' : winnerId === game.away_team_id ? 'win' : 'lose'
  const date = game.scheduled_at
    ? `${new Date(game.scheduled_at).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })} · ${new Date(game.scheduled_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`
    : null

  return (
    <div className={`pf-match${highlight ? ' pf-match--final' : ''}`}>
      <div className="pf-card">
        <TeamRow team={game.home_team} seed={be?.home_seed ?? null} score={showScore ? game.home_score ?? 0 : null} state={homeState as any} />
        <TeamRow team={game.away_team} seed={be?.away_seed ?? null} score={showScore ? game.away_score ?? 0 : null} state={awayState as any} />
      </div>
      <div className="pf-meta">
        {title && <span className="pf-meta-title">{title}</span>}
        {isLive ? <span className="pf-meta-live">● LIVE</span> : date && <span>{date}</span>}
      </div>
    </div>
  )
}

function TeamRow({ team, seed, score, state }: {
  team: any
  seed: number | null
  score: number | null
  state: 'win' | 'lose' | 'neutral'
}) {
  const color = team?.primary_color ?? '#9aa0b5'
  const fg = team ? textOn(color) : '#7a7a8a'
  const lose = state === 'lose'
  return (
    <div className="pf-team" style={{
      background: team ? color : 'rgba(128,128,128,0.14)',
      opacity: lose ? 0.4 : 1,
      filter: lose ? 'grayscale(0.3)' : 'none',
    }}>
      <span className="pf-seed" style={{ color: fg, opacity: 0.65 }}>{seed ?? ''}</span>
      {team?.logo_url
        ? <img src={team.logo_url} alt="" className="pf-logo" />
        : <span className="pf-logo" />}
      <span className="pf-name" style={{ color: fg, fontWeight: state === 'win' ? 900 : 700 }}>
        {team?.short_name ?? 'TBD'}
      </span>
      {score !== null && <span className="pf-pts" style={{ color: fg }}>{score}</span>}
    </div>
  )
}

function PlaceholderBox({ label }: { label: string }) {
  return (
    <div className="pf-match">
      <div className="pf-card pf-card--placeholder">{label} TBD</div>
    </div>
  )
}

function ChampionBox({ team }: { team: any }) {
  const color = team?.primary_color ?? null
  const fg = color ? textOn(color) : '#ff1d25'
  const accent = color ? fg : '#ff1d25'
  return (
    <div
      className="pf-champ"
      style={color
        ? { background: color, borderColor: color }
        : { background: 'rgba(255,29,37,0.05)', borderColor: 'rgba(255,29,37,0.4)' }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 6 }}>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
      <div className="pf-champ-label" style={{ color: accent, opacity: 0.85 }}>Champion</div>
      {team?.logo_url && <img src={team.logo_url} alt="" className="pf-champ-logo" />}
      <div className="pf-champ-name" style={{ color: color ? fg : '#94a3b8' }}>
        {team?.short_name ?? 'TBD'}
      </div>
    </div>
  )
}
