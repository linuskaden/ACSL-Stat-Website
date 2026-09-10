import Link from 'next/link'
import { SectionHeader, TableWrapper, Th, Td } from '@/components/BoxScoreUI'

const QUARTER_ORDER = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'] as const

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

function rowPoints(r: RawStat): number {
  return (r.rush_tds + r.qb_rush_tds + r.rec_tds) * 6 + r.ep_made + r.fg_made * 3
}

function addStats(a: Partial<RawStat>, b: RawStat): Partial<RawStat> {
  const NUM_KEYS = [
    'pass_yards','pass_attempts','pass_completions','pass_tds','interceptions_thrown',
    'qb_rush_yards','qb_rush_tds','rush_carries','rush_yards','rush_tds',
    'rb_rec_yards','rb_receptions','rec_yards','receptions','rec_tds',
    'sacks','def_interceptions','fg_made','fg_attempts','ep_made','ep_attempts',
  ] as const
  const out: any = { ...a }
  for (const k of NUM_KEYS) out[k] = ((a as any)[k] ?? 0) + (b[k] ?? 0)
  return out
}

type PlayerTotal = { player_id: string; team_id: string; player: RawStat['player']; totals: Partial<RawStat> }

function aggregatePlayers(stats: RawStat[]): Map<string, PlayerTotal> {
  const map = new Map<string, PlayerTotal>()
  for (const r of stats) {
    if (!r.player) continue
    if (!map.has(r.player_id)) map.set(r.player_id, { player_id: r.player_id, team_id: r.team_id, player: r.player, totals: {} })
    const entry = map.get(r.player_id)!
    entry.totals = addStats(entry.totals, r)
  }
  return map
}

function n(v: number | undefined, decimals = 0): string {
  const num = v ?? 0
  return decimals > 0 ? num.toFixed(decimals) : String(num)
}
function ypa(yards: number | undefined, att: number | undefined): string {
  const y = yards ?? 0, a = att ?? 0
  return a > 0 ? (y / a).toFixed(1) : '0.0'
}

export default function FootballBoxScore({ g, stats }: { g: any; stats: RawStat[] }) {
  const isFinal = g.status === 'final'
  const isLive = g.status === 'live'
  const homeColor = g.home_team?.primary_color ?? '#ccc'
  const awayColor = g.away_team?.primary_color ?? '#ccc'

  const quarterPts: Record<string, { home: number; away: number }> = {}
  for (const r of stats) {
    if (!quarterPts[r.quarter]) quarterPts[r.quarter] = { home: 0, away: 0 }
    const pts = rowPoints(r)
    if (r.team_id === g.home_team_id) quarterPts[r.quarter].home += pts
    else if (r.team_id === g.away_team_id) quarterPts[r.quarter].away += pts
  }
  const activeQuarters = QUARTER_ORDER.filter(q => quarterPts[q])

  const homeStats = stats.filter(r => r.team_id === g.home_team_id)
  const awayStats = stats.filter(r => r.team_id === g.away_team_id)

  function teamSum(rows: RawStat[]) {
    return rows.reduce(
      (acc, r) => {
        const passYds = r.pass_yards
        const rushYds = r.rush_yards + r.qb_rush_yards
        return {
          purePassYds: acc.purePassYds + passYds,
          rushYds: acc.rushYds + rushYds,
          totalYds: acc.totalYds + passYds + rushYds,
          passTds: acc.passTds + r.pass_tds,
          rushTds: acc.rushTds + r.rush_tds + r.qb_rush_tds,
          recTds: acc.recTds + r.rec_tds,
          ints: acc.ints + r.interceptions_thrown,
          sacks: acc.sacks + r.sacks,
          defInts: acc.defInts + r.def_interceptions,
        }
      },
      { purePassYds: 0, rushYds: 0, totalYds: 0, passTds: 0, rushTds: 0, recTds: 0, ints: 0, sacks: 0, defInts: 0 }
    )
  }
  const homeTotals = teamSum(homeStats)
  const awayTotals = teamSum(awayStats)

  const playerMap = aggregatePlayers(stats)
  const allPlayers = Array.from(playerMap.values())
  const homePlayers = allPlayers.filter(p => p.team_id === g.home_team_id)
  const awayPlayers = allPlayers.filter(p => p.team_id === g.away_team_id)

  const passers = (arr: typeof allPlayers) => arr.filter(p => (p.totals.pass_attempts ?? 0) > 0).sort((a,b) => (b.totals.pass_yards ?? 0) - (a.totals.pass_yards ?? 0))
  const rushers = (arr: typeof allPlayers) => arr.filter(p => ((p.totals.rush_yards ?? 0) + (p.totals.qb_rush_yards ?? 0)) > 0).sort((a,b) => ((b.totals.rush_yards ?? 0) + (b.totals.qb_rush_yards ?? 0)) - ((a.totals.rush_yards ?? 0) + (a.totals.qb_rush_yards ?? 0)))
  const receivers = (arr: typeof allPlayers) => arr.filter(p => ((p.totals.receptions ?? 0) + (p.totals.rb_receptions ?? 0)) > 0).sort((a,b) => ((b.totals.rec_yards ?? 0) + (b.totals.rb_rec_yards ?? 0)) - ((a.totals.rec_yards ?? 0) + (a.totals.rb_rec_yards ?? 0)))
  const defenders = (arr: typeof allPlayers) => arr.filter(p => (p.totals.sacks ?? 0) > 0 || (p.totals.def_interceptions ?? 0) > 0).sort((a,b) => (b.totals.sacks ?? 0) - (a.totals.sacks ?? 0))

  const TeamCell = ({ p }: { p: PlayerTotal }) => (
    <Td>
      <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ background: p.team_id === g.home_team_id ? homeColor : awayColor }} />
      {p.team_id === g.home_team_id ? g.home_team?.short_name : g.away_team?.short_name}
    </Td>
  )
  const NameCell = ({ p }: { p: PlayerTotal }) => (
    <Td>
      <Link href={`/players/${p.player_id}`} className="font-semibold text-slate-900 dark:text-white hover:text-[#ff1d25] transition-colors">
        {p.player?.first_name} {p.player?.last_name}
      </Link>
      <span className="ml-1.5 text-[11px] text-slate-400 dark:text-[#555]">{p.player?.positions.join('/')}</span>
    </Td>
  )

  return (
    <>
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
              <tr className="bg-white dark:bg-[#111]">
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: homeColor }} />
                    <span className="font-semibold text-slate-900 dark:text-white">{g.home_team?.short_name ?? '—'}</span>
                  </div>
                </Td>
                {activeQuarters.map(q => <Td key={q} right>{quarterPts[q]?.home ?? 0}</Td>)}
                <Td right bold>{isFinal || isLive ? (g.home_score ?? 0) : activeQuarters.reduce((s, q) => s + (quarterPts[q]?.home ?? 0), 0)}</Td>
              </tr>
              <tr className="bg-white dark:bg-[#111]">
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: awayColor }} />
                    <span className="font-semibold text-slate-900 dark:text-white">{g.away_team?.short_name ?? '—'}</span>
                  </div>
                </Td>
                {activeQuarters.map(q => <Td key={q} right>{quarterPts[q]?.away ?? 0}</Td>)}
                <Td right bold>{isFinal || isLive ? (g.away_score ?? 0) : activeQuarters.reduce((s, q) => s + (quarterPts[q]?.away ?? 0), 0)}</Td>
              </tr>
            </tbody>
          </TableWrapper>
        </>
      )}

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
            { label: 'Total Yards', h: homeTotals.totalYds, a: awayTotals.totalYds },
            { label: 'Passing Yards', h: homeTotals.purePassYds, a: awayTotals.purePassYds },
            { label: 'Rushing Yards', h: homeTotals.rushYds, a: awayTotals.rushYds },
            { label: 'Passing TDs', h: homeTotals.passTds, a: awayTotals.passTds },
            { label: 'Rushing TDs', h: homeTotals.rushTds, a: awayTotals.rushTds },
            { label: 'INTs Thrown', h: homeTotals.ints, a: awayTotals.ints },
            { label: 'Sacks', h: homeTotals.sacks, a: awayTotals.sacks },
            { label: 'Def. INTs', h: homeTotals.defInts, a: awayTotals.defInts },
          ].map(({ label, h, a }) => (
            <tr key={label} className="bg-white dark:bg-[#111]">
              <Td>{label}</Td>
              <Td right bold={h > a}>{h}</Td>
              <Td right bold={a > h}>{a}</Td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      {(passers(homePlayers).length > 0 || passers(awayPlayers).length > 0) && (
        <>
          <SectionHeader title="Passing" />
          <TableWrapper>
            <thead>
              <tr><Th>Player</Th><Th>Team</Th><Th right>C/ATT</Th><Th right>YDS</Th><Th right>TD</Th><Th right>INT</Th></tr>
            </thead>
            <tbody>
              {[...passers(homePlayers), ...passers(awayPlayers)].map(p => (
                <tr key={p.player_id} className="bg-white dark:bg-[#111]">
                  <NameCell p={p} />
                  <TeamCell p={p} />
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

      {(rushers(homePlayers).length > 0 || rushers(awayPlayers).length > 0) && (
        <>
          <SectionHeader title="Rushing" />
          <TableWrapper>
            <thead>
              <tr><Th>Player</Th><Th>Team</Th><Th right>CAR</Th><Th right>YDS</Th><Th right>TD</Th><Th right>YPC</Th></tr>
            </thead>
            <tbody>
              {[...rushers(homePlayers), ...rushers(awayPlayers)].map(p => {
                const rushYds = (p.totals.rush_yards ?? 0) + (p.totals.qb_rush_yards ?? 0)
                const rushCar = (p.totals.rush_carries ?? 0)
                const rushTds = (p.totals.rush_tds ?? 0) + (p.totals.qb_rush_tds ?? 0)
                return (
                  <tr key={p.player_id} className="bg-white dark:bg-[#111]">
                    <NameCell p={p} />
                    <TeamCell p={p} />
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

      {(receivers(homePlayers).length > 0 || receivers(awayPlayers).length > 0) && (
        <>
          <SectionHeader title="Receiving" />
          <TableWrapper>
            <thead>
              <tr><Th>Player</Th><Th>Team</Th><Th right>REC</Th><Th right>YDS</Th><Th right>TD</Th><Th right>YPR</Th></tr>
            </thead>
            <tbody>
              {[...receivers(homePlayers), ...receivers(awayPlayers)].map(p => {
                const recYds = (p.totals.rec_yards ?? 0) + (p.totals.rb_rec_yards ?? 0)
                const recCnt = (p.totals.receptions ?? 0) + (p.totals.rb_receptions ?? 0)
                return (
                  <tr key={p.player_id} className="bg-white dark:bg-[#111]">
                    <NameCell p={p} />
                    <TeamCell p={p} />
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

      {(defenders(homePlayers).length > 0 || defenders(awayPlayers).length > 0) && (
        <>
          <SectionHeader title="Defense" />
          <TableWrapper>
            <thead>
              <tr><Th>Player</Th><Th>Team</Th><Th right>SACKS</Th><Th right>INT</Th></tr>
            </thead>
            <tbody>
              {[...defenders(homePlayers), ...defenders(awayPlayers)].map(p => (
                <tr key={p.player_id} className="bg-white dark:bg-[#111]">
                  <NameCell p={p} />
                  <TeamCell p={p} />
                  <Td right bold>{n(p.totals.sacks, 1)}</Td>
                  <Td right>{n(p.totals.def_interceptions)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </>
      )}
    </>
  )
}
