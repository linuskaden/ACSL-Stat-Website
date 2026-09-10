import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason } from '@/lib/season'
import { getSelectedCompetition } from '@/lib/competition'
import { LEADER_CATS, LEADER_GROUPS, POSITIONS, emptyBballTotals, addBballRow, bballDerived } from '@/lib/sportConfig'
import LeadersClient, { type LeaderEntry } from '@/components/LeadersClient'

export const revalidate = 60

const PLAYOFF_TYPES = ['wildcard', 'semifinal', 'third_place', 'final']
const PLAYER_SELECT = 'id,first_name,last_name,jersey_number,positions,team:teams(id,name,short_name,slug,primary_color,logo_url)'

// ── Football ────────────────────────────────────────────────────────────────
const NUM_FIELDS = [
  'pass_yards','pass_tds','pass_completions','pass_attempts','interceptions_thrown',
  'qb_rush_yards','qb_rush_tds','rush_yards','rush_tds','rush_carries',
  'rb_rec_yards','rb_receptions','rb_targets','rec_yards','rec_tds','receptions','rec_targets',
  'sacks','def_interceptions','fg_made','fg_attempts','ep_made','ep_attempts',
] as const
type NumField = typeof NUM_FIELDS[number]
type Team = { id: string; name: string; short_name: string; slug: string; primary_color: string; logo_url: string | null }
type PlayerMeta = { id: string; first_name: string; last_name: string; jersey_number: number | null; positions: string[]; team: Team | null }
type Computed = { player: PlayerMeta; games_played: number; s: Record<string, number | null> }

function footballRow(player: PlayerMeta, t: Record<NumField, number>, games_played: number): Computed {
  const passAtt = t.pass_attempts ?? 0
  const total_rush_tds = (t.rush_tds ?? 0) + (t.qb_rush_tds ?? 0)
  const total_tds = total_rush_tds + (t.rec_tds ?? 0)
  return {
    player, games_played,
    s: {
      pass_yards: t.pass_yards ?? 0, pass_tds: t.pass_tds ?? 0, pass_completions: t.pass_completions ?? 0,
      pass_attempts: passAtt, interceptions_thrown: t.interceptions_thrown ?? 0,
      total_rush_yards: (t.rush_yards ?? 0) + (t.qb_rush_yards ?? 0), total_rush_tds,
      total_rec_yards: (t.rec_yards ?? 0) + (t.rb_rec_yards ?? 0),
      total_receptions: (t.receptions ?? 0) + (t.rb_receptions ?? 0), rec_tds: t.rec_tds ?? 0,
      total_tds, points: total_tds * 6 + (t.fg_made ?? 0) * 3 + (t.ep_made ?? 0),
      sacks: t.sacks ?? 0, def_interceptions: t.def_interceptions ?? 0,
      fg_made: t.fg_made ?? 0, fg_attempts: t.fg_attempts ?? 0, ep_made: t.ep_made ?? 0,
      comp_pct: passAtt >= 5 ? Math.round((t.pass_completions ?? 0) / passAtt * 1000) / 10 : null,
      fg_pct: (t.fg_attempts ?? 0) >= 1 ? Math.round((t.fg_made ?? 0) / t.fg_attempts * 1000) / 10 : null,
    },
  }
}

function footballFromGameStats(rows: any[]): Computed[] {
  const map = new Map<string, { player: PlayerMeta; gameIds: Set<string>; totals: Record<NumField, number> }>()
  for (const row of rows ?? []) {
    if (!row.player) continue
    const pid: string = row.player_id
    if (!map.has(pid)) map.set(pid, { player: row.player as PlayerMeta, gameIds: new Set(), totals: Object.fromEntries(NUM_FIELDS.map(f => [f, 0])) as Record<NumField, number> })
    const e = map.get(pid)!
    e.gameIds.add(row.game_id)
    for (const f of NUM_FIELDS) e.totals[f] = (e.totals[f] ?? 0) + (row[f] ?? 0)
  }
  return [...map.values()].map(({ player, gameIds, totals }) => footballRow(player, totals, gameIds.size))
}

const FB_SUMMABLE = ['pass_yards','pass_tds','pass_completions','pass_attempts','interceptions_thrown','total_rush_yards','total_rush_tds','total_rec_yards','total_receptions','rec_tds','total_tds','points','sacks','def_interceptions','fg_made','fg_attempts','ep_made']

function footballTeams(rows: Computed[]): LeaderEntry[] {
  const map = new Map<string, { team: Team; sums: Record<string, number> }>()
  for (const c of rows) {
    const t = c.player.team; if (!t) continue
    if (!map.has(t.id)) map.set(t.id, { team: t, sums: Object.fromEntries(FB_SUMMABLE.map(k => [k, 0])) })
    const acc = map.get(t.id)!
    for (const k of FB_SUMMABLE) acc.sums[k] += (c.s[k] ?? 0)
  }
  return [...map.values()].map(({ team, sums }) => {
    const s: Record<string, number | null> = { ...sums }
    s.comp_pct = sums.pass_attempts >= 1 ? Math.round(sums.pass_completions / sums.pass_attempts * 1000) / 10 : null
    s.fg_pct = sums.fg_attempts >= 1 ? Math.round(sums.fg_made / sums.fg_attempts * 1000) / 10 : null
    return teamEntry(team, s)
  })
}

function footballPlayerEntry(c: Computed): LeaderEntry {
  return playerEntry(c.player, c.games_played, c.s)
}

// ── Basketball ────────────────────────────────────────────────────────────────
function bballPlayers(rows: any[]): LeaderEntry[] {
  const map = new Map<string, { player: PlayerMeta; gameIds: Set<string>; totals: Record<string, number> }>()
  for (const row of rows ?? []) {
    if (!row.player) continue
    const pid: string = row.player_id
    if (!map.has(pid)) map.set(pid, { player: row.player as PlayerMeta, gameIds: new Set(), totals: emptyBballTotals() })
    const e = map.get(pid)!
    e.gameIds.add(row.game_id)
    addBballRow(e.totals, row)
  }
  return [...map.values()].map(({ player, gameIds, totals }) => playerEntry(player, gameIds.size, bballDerived(totals)))
}

function bballTeams(rows: any[]): LeaderEntry[] {
  const map = new Map<string, { team: Team; totals: Record<string, number> }>()
  for (const row of rows ?? []) {
    const t = row.player?.team as Team | undefined
    if (!t) continue
    if (!map.has(t.id)) map.set(t.id, { team: t, totals: emptyBballTotals() })
    addBballRow(map.get(t.id)!.totals, row)
  }
  return [...map.values()].map(({ team, totals }) => teamEntry(team, bballDerived(totals)))
}

// ── Shared entry builders ─────────────────────────────────────────────────────
function playerEntry(p: PlayerMeta, games_played: number, s: Record<string, number | null>): LeaderEntry {
  const t = p.team
  return {
    id: p.id, name: `${p.first_name} ${p.last_name}`,
    subtitle: `${t?.short_name ?? '—'} · ${p.positions.join('/')}`,
    href: `/players/${p.id}`, color: t?.primary_color ?? '#888', logo: t?.logo_url ?? null,
    jersey: p.jersey_number, positions: p.positions, teamId: t?.id ?? null, teamShort: t?.short_name ?? null,
    games_played, s,
  }
}
function teamEntry(team: Team, s: Record<string, number | null>): LeaderEntry {
  return {
    id: team.id, name: team.name, subtitle: '', href: `/teams/${team.slug}`,
    color: team.primary_color, logo: team.logo_url ?? null, jersey: null, positions: [],
    teamId: team.id, teamShort: team.short_name, games_played: 0, s,
  }
}

export default async function StatsPage() {
  const supabase = await createClient()
  const competition = await getSelectedCompetition()
  const season = await getSelectedSeason(competition)
  const sport = competition.sport

  const { data: finalGames } = await supabase
    .from('games').select('id, game_type')
    .eq('competition_id', competition.id).eq('season', season).eq('status', 'final')

  const regularIds = new Set((finalGames ?? []).filter((g: any) => g.game_type === 'regular_season').map((g: any) => g.id))
  const playoffIds = new Set((finalGames ?? []).filter((g: any) => PLAYOFF_TYPES.includes(g.game_type)).map((g: any) => g.id))
  const allIds = [...regularIds, ...playoffIds]

  const statsTable = sport === 'basketball' ? 'bball_game_stats' : 'game_stats'
  const { data: statRows } = allIds.length > 0
    ? await supabase.from(statsTable).select(`*, player:players(${PLAYER_SELECT})`).in('game_id', allIds)
    : { data: [] as any[] }

  const rows = (statRows ?? []) as any[]
  const reg = rows.filter(r => regularIds.has(r.game_id))
  const pl = rows.filter(r => playoffIds.has(r.game_id))

  let playersRegular: LeaderEntry[], playersPlayoff: LeaderEntry[], teamsRegular: LeaderEntry[], teamsPlayoff: LeaderEntry[]
  if (sport === 'basketball') {
    playersRegular = bballPlayers(reg); playersPlayoff = bballPlayers(pl)
    teamsRegular = bballTeams(reg); teamsPlayoff = bballTeams(pl)
  } else {
    const cr = footballFromGameStats(reg), cp = footballFromGameStats(pl)
    playersRegular = cr.map(footballPlayerEntry); playersPlayoff = cp.map(footballPlayerEntry)
    teamsRegular = footballTeams(cr); teamsPlayoff = footballTeams(cp)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <LeadersClient
        playersRegular={playersRegular}
        playersPlayoff={playersPlayoff}
        teamsRegular={teamsRegular}
        teamsPlayoff={teamsPlayoff}
        cats={LEADER_CATS[sport]}
        groups={LEADER_GROUPS[sport]}
        positions={POSITIONS[sport]}
      />
    </div>
  )
}
