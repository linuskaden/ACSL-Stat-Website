import Link from 'next/link'
import { SectionHeader, TableWrapper, Th, Td } from '@/components/BoxScoreUI'

const QUARTER_ORDER = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'] as const
const FIELDS = ['fg_made', 'fg_att', 'three_made', 'three_att', 'ft_made', 'ft_att', 'reb', 'assists'] as const

type RawStat = {
  id: string
  game_id: string
  player_id: string
  team_id: string
  quarter: string
  fg_made: number
  fg_att: number
  three_made: number
  three_att: number
  ft_made: number
  ft_att: number
  reb: number
  assists: number
  player: { id: string; first_name: string; last_name: string; positions: string[] } | null
}

type Totals = Record<(typeof FIELDS)[number], number>

function emptyTotals(): Totals {
  return { fg_made: 0, fg_att: 0, three_made: 0, three_att: 0, ft_made: 0, ft_att: 0, reb: 0, assists: 0 }
}
function addRow(acc: Totals, r: Partial<Totals>) {
  for (const k of FIELDS) acc[k] += r[k] ?? 0
}
function pts(t: Pick<Totals, 'fg_made' | 'three_made' | 'ft_made'>): number {
  return 2 * t.fg_made + t.three_made + t.ft_made
}
function pct(made: number, att: number): string {
  return att >= 1 ? `${(made / att * 100).toFixed(1)}%` : '—'
}

type PlayerTotal = { player_id: string; team_id: string; player: RawStat['player']; totals: Totals }

function aggregate(stats: RawStat[]): PlayerTotal[] {
  const map = new Map<string, PlayerTotal>()
  for (const r of stats) {
    if (!r.player) continue
    if (!map.has(r.player_id)) map.set(r.player_id, { player_id: r.player_id, team_id: r.team_id, player: r.player, totals: emptyTotals() })
    addRow(map.get(r.player_id)!.totals, r)
  }
  return [...map.values()]
}

function TeamBoxTable({ title, color, players }: { title: string; color: string; players: PlayerTotal[] }) {
  const sorted = [...players].sort((a, b) => pts(b.totals) - pts(a.totals))
  const team = emptyTotals()
  for (const p of players) addRow(team, p.totals)

  return (
    <>
      <SectionHeader title={title} />
      <TableWrapper>
        <thead>
          <tr>
            <Th>Player</Th>
            <Th right>PTS</Th>
            <Th right>REB</Th>
            <Th right>AST</Th>
            <Th right>FG</Th>
            <Th right>3P</Th>
            <Th right>FT</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => (
            <tr key={p.player_id} className="bg-white dark:bg-[#111]">
              <Td>
                <Link href={`/players/${p.player_id}`} className="font-semibold text-slate-900 dark:text-white hover:text-[#ff1d25] transition-colors">
                  {p.player?.first_name} {p.player?.last_name}
                </Link>
                <span className="ml-1.5 text-[11px] text-slate-400 dark:text-[#555]">{p.player?.positions.join('/')}</span>
              </Td>
              <Td right bold>{pts(p.totals)}</Td>
              <Td right>{p.totals.reb}</Td>
              <Td right>{p.totals.assists}</Td>
              <Td right>{p.totals.fg_made}-{p.totals.fg_att}</Td>
              <Td right>{p.totals.three_made}-{p.totals.three_att}</Td>
              <Td right>{p.totals.ft_made}-{p.totals.ft_att}</Td>
            </tr>
          ))}
          <tr className="bg-[#f7f8fa] dark:bg-[#181818]">
            <Td bold>
              <span className="w-2.5 h-2.5 rounded-full inline-block mr-2" style={{ background: color }} />
              Total
            </Td>
            <Td right bold>{pts(team)}</Td>
            <Td right bold>{team.reb}</Td>
            <Td right bold>{team.assists}</Td>
            <Td right bold>{team.fg_made}-{team.fg_att}</Td>
            <Td right bold>{team.three_made}-{team.three_att}</Td>
            <Td right bold>{team.ft_made}-{team.ft_att}</Td>
          </tr>
        </tbody>
      </TableWrapper>
    </>
  )
}

export default function BballBoxScore({ g, stats }: { g: any; stats: RawStat[] }) {
  const isFinal = g.status === 'final'
  const isLive = g.status === 'live'
  const homeColor = g.home_team?.primary_color ?? '#ccc'
  const awayColor = g.away_team?.primary_color ?? '#ccc'

  // Quarter scoring
  const quarterPts: Record<string, { home: number; away: number }> = {}
  for (const r of stats) {
    if (!quarterPts[r.quarter]) quarterPts[r.quarter] = { home: 0, away: 0 }
    const p = pts(r)
    if (r.team_id === g.home_team_id) quarterPts[r.quarter].home += p
    else if (r.team_id === g.away_team_id) quarterPts[r.quarter].away += p
  }
  const activeQuarters = QUARTER_ORDER.filter(q => quarterPts[q])

  // Team totals
  const homeTotals = emptyTotals(), awayTotals = emptyTotals()
  for (const r of stats) {
    if (r.team_id === g.home_team_id) addRow(homeTotals, r)
    else if (r.team_id === g.away_team_id) addRow(awayTotals, r)
  }

  const players = aggregate(stats)
  const homePlayers = players.filter(p => p.team_id === g.home_team_id)
  const awayPlayers = players.filter(p => p.team_id === g.away_team_id)

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
            { label: 'Points', h: pts(homeTotals), a: pts(awayTotals) },
            { label: 'Field Goals', h: `${homeTotals.fg_made}-${homeTotals.fg_att}`, a: `${awayTotals.fg_made}-${awayTotals.fg_att}` },
            { label: 'FG %', h: pct(homeTotals.fg_made, homeTotals.fg_att), a: pct(awayTotals.fg_made, awayTotals.fg_att) },
            { label: '3-Pointers', h: `${homeTotals.three_made}-${homeTotals.three_att}`, a: `${awayTotals.three_made}-${awayTotals.three_att}` },
            { label: '3P %', h: pct(homeTotals.three_made, homeTotals.three_att), a: pct(awayTotals.three_made, awayTotals.three_att) },
            { label: 'Free Throws', h: `${homeTotals.ft_made}-${homeTotals.ft_att}`, a: `${awayTotals.ft_made}-${awayTotals.ft_att}` },
            { label: 'FT %', h: pct(homeTotals.ft_made, homeTotals.ft_att), a: pct(awayTotals.ft_made, awayTotals.ft_att) },
            { label: 'Rebounds', h: homeTotals.reb, a: awayTotals.reb },
            { label: 'Assists', h: homeTotals.assists, a: awayTotals.assists },
          ].map(({ label, h, a }) => {
            const hi = typeof h === 'number' && typeof a === 'number'
            return (
              <tr key={label} className="bg-white dark:bg-[#111]">
                <Td>{label}</Td>
                <Td right bold={hi ? (h as number) > (a as number) : false}>{h}</Td>
                <Td right bold={hi ? (a as number) > (h as number) : false}>{a}</Td>
              </tr>
            )
          })}
        </tbody>
      </TableWrapper>

      {homePlayers.length > 0 && (
        <TeamBoxTable title={g.home_team?.short_name ?? 'Home'} color={homeColor} players={homePlayers} />
      )}
      {awayPlayers.length > 0 && (
        <TeamBoxTable title={g.away_team?.short_name ?? 'Away'} color={awayColor} players={awayPlayers} />
      )}
    </>
  )
}
