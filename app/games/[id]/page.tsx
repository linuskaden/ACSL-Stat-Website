import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'
import { notFound } from 'next/navigation'

export const revalidate = 30

// ── Quarter order ─────────────────────────────────────────────────────────────
const QUARTER_ORDER = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'] as const

// ── Raw stat row from Supabase ────────────────────────────────────────────────
type RawStat = {
  id: string
  game_id: string
  player_id: string
  team_id: string
  quarter: string
  pass_yards: number
  pass_attempts: number
  pass_completions: number
  pass_tds: number
  interceptions_thrown: number
  qb_rush_yards: number
  qb_rush_tds: number
  rush_carries: number
  rush_yards: number
  rush_tds: number
  rb_rec_yards: number
  rb_receptions: number
  rec_yards: number
  receptions: number
  rec_tds: number
  sacks: number
  def_interceptions: number
  fg_made: number
  fg_attempts: number
  ep_made: number
  ep_attempts: number
  player: { id: string; first_name: string; last_name: string; positions: string[] } | null
}

// Points for a single row — avoids double-counting pass TDs (already in rec_tds)
function rowPoints(r: RawStat): number {
  return (r.rush_tds + r.qb_rush_tds + r.rec_tds) * 6 + r.ep_made + r.fg_made * 3
}

// Sum two stat records together
function addStats(a: Partial<RawStat>, b: RawStat): Partial<RawStat> {
  const NUM_KEYS = [
    'pass_yards','pass_attempts','pass_completions','pass_tds','interceptions_thrown',
    'qb_rush_yards','qb_rush_tds','rush_carries','rush_yards','rush_tds',
    'rb_rec_yards','rb_receptions','rec_yards','receptions','rec_tds',
    'sacks','def_interceptions','fg_made','fg_attempts','ep_made','ep_attempts',
  ] as const
  const out: any = { ...a }
  for (const k of NUM_KEYS) {
    out[k] = ((a as any)[k] ?? 0) + (b[k] ?? 0)
  }
  return out
}

// ── Aggregated player totals ──────────────────────────────────────────────────
type PlayerTotal = {
  player_id: string
  team_id: string
  player: RawStat['player']
  totals: Partial<RawStat>
}

function aggregatePlayers(stats: RawStat[]): Map<string, PlayerTotal> {
  const map = new Map<string, PlayerTotal>()
  for (const r of stats) {
    if (!r.player) continue
    if (!map.has(r.player_id)) {
      map.set(r.player_id, {
        player_id: r.player_id,
        team_id: r.team_id,
        player: r.player,
        totals: {},
      })
    }
    const entry = map.get(r.player_id)!
    entry.totals = addStats(entry.totals, r)
  }
  return map
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function n(v: number | undefined, decimals = 0): string {
  const num = v ?? 0
  return decimals > 0 ? num.toFixed(decimals) : String(num)
}

function ypa(yards: number | undefined, att: number | undefined): string {
  const y = yards ?? 0
  const a = att ?? 0
  return a > 0 ? (y / a).toFixed(1) : '—'
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-3 mt-6">
      {title}
    </h3>
  )
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-black/[0.07] dark:border-white/5 shadow-sm mb-6">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] bg-[#f7f8fa] dark:bg-[#181818] ${right ? 'text-right' : 'text-left'} first:pl-4 last:pr-4`}>
      {children}
    </th>
  )
}

function Td({ children, right, bold }: { children: React.ReactNode; right?: boolean; bold?: boolean }) {
  return (
    <td className={`px-3 py-2.5 text-slate-700 dark:text-[#ccc] border-t border-black/[0.04] dark:border-white/[0.04] ${right ? 'text-right tabular-nums' : ''} ${bold ? 'font-semibold text-slate-900 dark:text-white' : ''} first:pl-4 last:pr-4`}>
      {children}
    </td>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function BoxScorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch game + teams
  const { data: game } = await supabase
    .from('games')
    .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
    .eq('id', id)
    .single()

  if (!game) notFound()

  const g = game as any

  // Fetch all stats for this game
  const { data: rawStats } = await supabase
    .from('game_stats')
    .select('*, player:players(id, first_name, last_name, positions)')
    .eq('game_id', id)

  const stats = (rawStats ?? []) as RawStat[]

  // ── Quarter scores ──────────────────────────────────────────────────────────
  const quarterPts: Record<string, { home: number; away: number }> = {}
  for (const r of stats) {
    if (!quarterPts[r.quarter]) quarterPts[r.quarter] = { home: 0, away: 0 }
    const pts = rowPoints(r)
    if (r.team_id === g.home_team_id) quarterPts[r.quarter].home += pts
    else if (r.team_id === g.away_team_id) quarterPts[r.quarter].away += pts
  }

  const activeQuarters = QUARTER_ORDER.filter(q => quarterPts[q])

  // ── Team totals ─────────────────────────────────────────────────────────────
  const homeStats = stats.filter(r => r.team_id === g.home_team_id)
  const awayStats = stats.filter(r => r.team_id === g.away_team_id)

  function teamSum(rows: RawStat[]) {
    return rows.reduce(
      (acc, r) => {
        const passYds = r.pass_yards
        const rushYds = r.rush_yards + r.qb_rush_yards
        return {
          purePassYds: acc.purePassYds + passYds,
          rushYds:     acc.rushYds     + rushYds,
          // Total offense = passing + rushing (receiving yards are the same yards as passing)
          totalYds:    acc.totalYds    + passYds + rushYds,
          passTds:     acc.passTds     + r.pass_tds,
          rushTds:     acc.rushTds     + r.rush_tds + r.qb_rush_tds,
          recTds:      acc.recTds      + r.rec_tds,
          ints:        acc.ints        + r.interceptions_thrown,
          sacks:       acc.sacks       + r.sacks,
          defInts:     acc.defInts     + r.def_interceptions,
        }
      },
      { purePassYds: 0, rushYds: 0, totalYds: 0, passTds: 0, rushTds: 0, recTds: 0, ints: 0, sacks: 0, defInts: 0 }
    )
  }

  const homeTotals = teamSum(homeStats)
  const awayTotals = teamSum(awayStats)

  // ── Player totals ───────────────────────────────────────────────────────────
  const playerMap = aggregatePlayers(stats)
  const allPlayers = Array.from(playerMap.values())

  const homePlayers = allPlayers.filter(p => p.team_id === g.home_team_id)
  const awayPlayers = allPlayers.filter(p => p.team_id === g.away_team_id)

  // Filter helpers
  const passers  = (arr: typeof allPlayers) => arr.filter(p => (p.totals.pass_attempts ?? 0) > 0).sort((a,b) => (b.totals.pass_yards ?? 0) - (a.totals.pass_yards ?? 0))
  const rushers  = (arr: typeof allPlayers) => arr.filter(p => ((p.totals.rush_yards ?? 0) + (p.totals.qb_rush_yards ?? 0)) > 0).sort((a,b) => ((b.totals.rush_yards ?? 0) + (b.totals.qb_rush_yards ?? 0)) - ((a.totals.rush_yards ?? 0) + (a.totals.qb_rush_yards ?? 0)))
  const receivers = (arr: typeof allPlayers) => arr.filter(p => ((p.totals.receptions ?? 0) + (p.totals.rb_receptions ?? 0)) > 0).sort((a,b) => ((b.totals.rec_yards ?? 0) + (b.totals.rb_rec_yards ?? 0)) - ((a.totals.rec_yards ?? 0) + (a.totals.rb_rec_yards ?? 0)))
  const defenders = (arr: typeof allPlayers) => arr.filter(p => (p.totals.sacks ?? 0) > 0 || (p.totals.def_interceptions ?? 0) > 0).sort((a,b) => (b.totals.sacks ?? 0) - (a.totals.sacks ?? 0))

  const hasStats = stats.length > 0
  const isFinal = g.status === 'final'
  const isLive  = g.status === 'live'

  const homeColor = g.home_team?.primary_color ?? '#ccc'
  const awayColor = g.away_team?.primary_color ?? '#ccc'

  // Date formatting
  const gameDate = g.scheduled_at
    ? new Date(g.scheduled_at).toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })
    : null

  const GAME_TYPE_LABELS: Record<string, string> = {
    regular_season: 'Regular Season',
    wildcard: 'Wildcard',
    semifinal: 'Semifinal',
    third_place: 'Spiel um Platz 3',
    final: 'Championship',
  }
  const gameTypeLabel = GAME_TYPE_LABELS[g.game_type] ?? g.game_type

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Back */}
      <Link href="/schedule" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-[#7a7a7a] hover:text-[#ff1d25] transition-colors mb-6">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Schedule
      </Link>

      {/* Game Header */}
      <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl p-6 shadow-sm mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-4 flex items-center gap-3">
          <span>{gameTypeLabel}</span>
          {gameDate && <><span className="text-slate-300 dark:text-[#444]">·</span><span>{gameDate}</span></>}
          {g.location && <><span className="text-slate-300 dark:text-[#444]">·</span><span>{g.location}</span></>}
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Home team */}
          <div className="flex items-center gap-3 flex-1">
            {g.home_team && <TeamBadge team={g.home_team} size="lg" />}
            <div>
              <div className="font-black text-xl text-slate-900 dark:text-white">{g.home_team?.short_name ?? '—'}</div>
              <div className="text-xs text-slate-400 dark:text-[#555]">{g.home_team?.name ?? ''}</div>
            </div>
          </div>

          {/* Score */}
          <div className="text-center shrink-0 px-6">
            {(isFinal || isLive) ? (
              <div className="flex items-center gap-3">
                <span className="font-black text-5xl text-slate-900 dark:text-white tabular-nums">{g.home_score ?? 0}</span>
                <span className="text-slate-300 dark:text-[#444] text-2xl font-light">–</span>
                <span className="font-black text-5xl text-slate-900 dark:text-white tabular-nums">{g.away_score ?? 0}</span>
              </div>
            ) : (
              <span className="text-slate-400 dark:text-[#555] font-semibold">vs</span>
            )}
            <div className="mt-1 text-xs font-semibold" style={{ color: isFinal ? '#04a550' : isLive ? '#ff1d25' : '#7a7a7a' }}>
              {isLive && <span className="animate-pulse mr-1">●</span>}
              {isFinal ? 'Final' : isLive ? 'LIVE' : 'Upcoming'}
            </div>
          </div>

          {/* Away team */}
          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="text-right">
              <div className="font-black text-xl text-slate-900 dark:text-white">{g.away_team?.short_name ?? '—'}</div>
              <div className="text-xs text-slate-400 dark:text-[#555]">{g.away_team?.name ?? ''}</div>
            </div>
            {g.away_team && <TeamBadge team={g.away_team} size="lg" />}
          </div>
        </div>
      </div>

      {/* No stats yet */}
      {!hasStats && (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-10 text-center text-slate-400 dark:text-[#555] text-sm shadow-sm">
          No stats available yet.
        </div>
      )}

      {hasStats && (
        <>
          {/* Quarter Scoring */}
          {activeQuarters.length > 0 && (
            <>
              <SectionHeader title="Scoring by Quarter" />
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>Team</Th>
                    {activeQuarters.map(q => <Th key={q} right>{q}</Th>)}
                    <Th right>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {/* Home */}
                  <tr className="bg-white dark:bg-[#111]">
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: homeColor }} />
                        <span className="font-semibold text-slate-900 dark:text-white">{g.home_team?.short_name ?? '—'}</span>
                      </div>
                    </Td>
                    {activeQuarters.map(q => (
                      <Td key={q} right>{quarterPts[q]?.home ?? 0}</Td>
                    ))}
                    <Td right bold>{isFinal || isLive ? (g.home_score ?? 0) : activeQuarters.reduce((s, q) => s + (quarterPts[q]?.home ?? 0), 0)}</Td>
                  </tr>
                  {/* Away */}
                  <tr className="bg-white dark:bg-[#111]">
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: awayColor }} />
                        <span className="font-semibold text-slate-900 dark:text-white">{g.away_team?.short_name ?? '—'}</span>
                      </div>
                    </Td>
                    {activeQuarters.map(q => (
                      <Td key={q} right>{quarterPts[q]?.away ?? 0}</Td>
                    ))}
                    <Td right bold>{isFinal || isLive ? (g.away_score ?? 0) : activeQuarters.reduce((s, q) => s + (quarterPts[q]?.away ?? 0), 0)}</Td>
                  </tr>
                </tbody>
              </TableWrapper>
            </>
          )}

          {/* Team Stats Comparison */}
          <SectionHeader title="Team Stats" />
          <TableWrapper>
            <thead>
              <tr>
                <Th>Stat</Th>
                <Th right>{g.home_team?.short_name ?? 'Home'}</Th>
                <Th right>{g.away_team?.short_name ?? 'Away'}</Th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Total Yards',    h: homeTotals.totalYds,   a: awayTotals.totalYds },
                { label: 'Passing Yards',  h: homeTotals.purePassYds, a: awayTotals.purePassYds },
                { label: 'Rushing Yards',  h: homeTotals.rushYds,    a: awayTotals.rushYds },
                { label: 'Passing TDs',    h: homeTotals.passTds,    a: awayTotals.passTds },
                { label: 'Rushing TDs',    h: homeTotals.rushTds,    a: awayTotals.rushTds },
                { label: 'INTs Thrown',    h: homeTotals.ints,       a: awayTotals.ints },
                { label: 'Sacks',          h: homeTotals.sacks,      a: awayTotals.sacks },
                { label: 'Def. INTs',      h: homeTotals.defInts,    a: awayTotals.defInts },
              ].map(({ label, h, a }) => (
                <tr key={label} className="bg-white dark:bg-[#111]">
                  <Td>{label}</Td>
                  <Td right bold={h > a}>{h}</Td>
                  <Td right bold={a > h}>{a}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>

          {/* ── Passing ── */}
          {(passers(homePlayers).length > 0 || passers(awayPlayers).length > 0) && (
            <>
              <SectionHeader title="Passing" />
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>Player</Th>
                    <Th>Team</Th>
                    <Th right>C/ATT</Th>
                    <Th right>YDS</Th>
                    <Th right>TD</Th>
                    <Th right>INT</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...passers(homePlayers), ...passers(awayPlayers)].map(p => (
                    <tr key={p.player_id} className="bg-white dark:bg-[#111]">
                      <Td>
                        <Link href={`/players/${p.player_id}`} className="font-semibold text-slate-900 dark:text-white hover:text-[#ff1d25] transition-colors">
                          {p.player?.first_name} {p.player?.last_name}
                        </Link>
                        <span className="ml-1.5 text-[11px] text-slate-400 dark:text-[#555]">{p.player?.positions.join('/')}</span>
                      </Td>
                      <Td>
                        <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ background: p.team_id === g.home_team_id ? homeColor : awayColor }} />
                        {p.team_id === g.home_team_id ? g.home_team?.short_name : g.away_team?.short_name}
                      </Td>
                      <Td right>{n(p.totals.pass_completions)}/{n(p.totals.pass_attempts)}</Td>
                      <Td right bold>{n(p.totals.pass_yards)}</Td>
                      <Td right>{n(p.totals.pass_tds)}</Td>
                      <Td right>{n(p.totals.interceptions_thrown)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </>
          )}

          {/* ── Rushing ── */}
          {(rushers(homePlayers).length > 0 || rushers(awayPlayers).length > 0) && (
            <>
              <SectionHeader title="Rushing" />
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>Player</Th>
                    <Th>Team</Th>
                    <Th right>CAR</Th>
                    <Th right>YDS</Th>
                    <Th right>TD</Th>
                    <Th right>YPC</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...rushers(homePlayers), ...rushers(awayPlayers)].map(p => {
                    const rushYds = (p.totals.rush_yards ?? 0) + (p.totals.qb_rush_yards ?? 0)
                    const rushCar = (p.totals.rush_carries ?? 0)
                    const rushTds = (p.totals.rush_tds ?? 0) + (p.totals.qb_rush_tds ?? 0)
                    return (
                      <tr key={p.player_id} className="bg-white dark:bg-[#111]">
                        <Td>
                          <Link href={`/players/${p.player_id}`} className="font-semibold text-slate-900 dark:text-white hover:text-[#ff1d25] transition-colors">
                            {p.player?.first_name} {p.player?.last_name}
                          </Link>
                          <span className="ml-1.5 text-[11px] text-slate-400 dark:text-[#555]">{p.player?.positions.join('/')}</span>
                        </Td>
                        <Td>
                          <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ background: p.team_id === g.home_team_id ? homeColor : awayColor }} />
                          {p.team_id === g.home_team_id ? g.home_team?.short_name : g.away_team?.short_name}
                        </Td>
                        <Td right>{rushCar}</Td>
                        <Td right bold>{rushYds}</Td>
                        <Td right>{rushTds}</Td>
                        <Td right>{ypa(rushYds, rushCar)}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </TableWrapper>
            </>
          )}

          {/* ── Receiving ── */}
          {(receivers(homePlayers).length > 0 || receivers(awayPlayers).length > 0) && (
            <>
              <SectionHeader title="Receiving" />
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>Player</Th>
                    <Th>Team</Th>
                    <Th right>REC</Th>
                    <Th right>YDS</Th>
                    <Th right>TD</Th>
                    <Th right>YPR</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...receivers(homePlayers), ...receivers(awayPlayers)].map(p => {
                    const recYds = (p.totals.rec_yards ?? 0) + (p.totals.rb_rec_yards ?? 0)
                    const recCnt = (p.totals.receptions ?? 0) + (p.totals.rb_receptions ?? 0)
                    return (
                      <tr key={p.player_id} className="bg-white dark:bg-[#111]">
                        <Td>
                          <Link href={`/players/${p.player_id}`} className="font-semibold text-slate-900 dark:text-white hover:text-[#ff1d25] transition-colors">
                            {p.player?.first_name} {p.player?.last_name}
                          </Link>
                          <span className="ml-1.5 text-[11px] text-slate-400 dark:text-[#555]">{p.player?.positions.join('/')}</span>
                        </Td>
                        <Td>
                          <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ background: p.team_id === g.home_team_id ? homeColor : awayColor }} />
                          {p.team_id === g.home_team_id ? g.home_team?.short_name : g.away_team?.short_name}
                        </Td>
                        <Td right bold>{recCnt}</Td>
                        <Td right bold>{recYds}</Td>
                        <Td right>{n(p.totals.rec_tds)}</Td>
                        <Td right>{ypa(recYds, recCnt)}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </TableWrapper>
            </>
          )}

          {/* ── Defense ── */}
          {(defenders(homePlayers).length > 0 || defenders(awayPlayers).length > 0) && (
            <>
              <SectionHeader title="Defense" />
              <TableWrapper>
                <thead>
                  <tr>
                    <Th>Player</Th>
                    <Th>Team</Th>
                    <Th right>SACKS</Th>
                    <Th right>INT</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...defenders(homePlayers), ...defenders(awayPlayers)].map(p => (
                    <tr key={p.player_id} className="bg-white dark:bg-[#111]">
                      <Td>
                        <Link href={`/players/${p.player_id}`} className="font-semibold text-slate-900 dark:text-white hover:text-[#ff1d25] transition-colors">
                          {p.player?.first_name} {p.player?.last_name}
                        </Link>
                        <span className="ml-1.5 text-[11px] text-slate-400 dark:text-[#555]">{p.player?.positions.join('/')}</span>
                      </Td>
                      <Td>
                        <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ background: p.team_id === g.home_team_id ? homeColor : awayColor }} />
                        {p.team_id === g.home_team_id ? g.home_team?.short_name : g.away_team?.short_name}
                      </Td>
                      <Td right bold>{n(p.totals.sacks, 1)}</Td>
                      <Td right>{n(p.totals.def_interceptions)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrapper>
            </>
          )}
        </>
      )}
    </div>
  )
}
