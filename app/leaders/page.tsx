import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason } from '@/lib/season'
import LeadersClient, { type LeaderEntry } from '@/components/LeadersClient'

export const revalidate = 60

// ── Numeric stat fields shared between career_stats and game_stats ──────────
const NUM_FIELDS = [
  'pass_yards','pass_tds','pass_completions','pass_attempts','interceptions_thrown',
  'qb_rush_yards','qb_rush_tds','rush_yards','rush_tds','rush_carries',
  'rb_rec_yards','rb_receptions','rb_targets',
  'rec_yards','rec_tds','receptions','rec_targets',
  'sacks','def_interceptions',
  'fg_made','fg_attempts','ep_made','ep_attempts',
] as const
type NumField = typeof NUM_FIELDS[number]

type Team = { id: string; name: string; short_name: string; slug: string; primary_color: string; logo_url: string | null }
type PlayerMeta = { id: string; first_name: string; last_name: string; jersey_number: number | null; positions: string[]; team: Team | null }

type Computed = {
  player: PlayerMeta
  games_played: number
  s: Record<string, number | null>
}

function computeRow(player: PlayerMeta, t: Record<NumField, number>, games_played: number): Computed {
  const passAtt = t.pass_attempts ?? 0
  const total_rush_tds = (t.rush_tds ?? 0) + (t.qb_rush_tds ?? 0)
  const total_tds = total_rush_tds + (t.rec_tds ?? 0)
  return {
    player,
    games_played,
    s: {
      pass_yards: t.pass_yards ?? 0,
      pass_tds: t.pass_tds ?? 0,
      pass_completions: t.pass_completions ?? 0,
      pass_attempts: passAtt,
      interceptions_thrown: t.interceptions_thrown ?? 0,
      total_rush_yards: (t.rush_yards ?? 0) + (t.qb_rush_yards ?? 0),
      total_rush_tds,
      total_rec_yards: (t.rec_yards ?? 0) + (t.rb_rec_yards ?? 0),
      total_receptions: (t.receptions ?? 0) + (t.rb_receptions ?? 0),
      rec_tds: t.rec_tds ?? 0,
      total_tds,
      points: total_tds * 6 + (t.fg_made ?? 0) * 3 + (t.ep_made ?? 0),
      sacks: t.sacks ?? 0,
      def_interceptions: t.def_interceptions ?? 0,
      fg_made: t.fg_made ?? 0,
      fg_attempts: t.fg_attempts ?? 0,
      ep_made: t.ep_made ?? 0,
      comp_pct: passAtt >= 5 ? Math.round((t.pass_completions ?? 0) / passAtt * 1000) / 10 : null,
      fg_pct: (t.fg_attempts ?? 0) >= 1 ? Math.round((t.fg_made ?? 0) / t.fg_attempts * 1000) / 10 : null,
    },
  }
}

function fromCareerStats(rows: any[]): Computed[] {
  return (rows ?? []).filter(r => r.player).map(r => {
    const totals = Object.fromEntries(NUM_FIELDS.map(f => [f, r[f] ?? 0])) as Record<NumField, number>
    return computeRow(r.player as PlayerMeta, totals, r.games_played ?? 0)
  })
}

function fromGameStats(rows: any[]): Computed[] {
  const map = new Map<string, { player: PlayerMeta; gameIds: Set<string>; totals: Record<NumField, number> }>()
  for (const row of rows ?? []) {
    if (!row.player) continue
    const pid: string = row.player_id
    if (!map.has(pid)) {
      map.set(pid, { player: row.player as PlayerMeta, gameIds: new Set(), totals: Object.fromEntries(NUM_FIELDS.map(f => [f, 0])) as Record<NumField, number> })
    }
    const entry = map.get(pid)!
    entry.gameIds.add(row.game_id as string)
    for (const f of NUM_FIELDS) entry.totals[f] = (entry.totals[f] ?? 0) + (row[f] ?? 0)
  }
  return [...map.values()].map(({ player, gameIds, totals }) => computeRow(player, totals, gameIds.size))
}

// ── Computed → LeaderEntry (player) ──────────────────────────────────────────
function toPlayerEntry(c: Computed): LeaderEntry {
  const t = c.player.team
  return {
    id: c.player.id,
    name: `${c.player.first_name} ${c.player.last_name}`,
    subtitle: `${t?.short_name ?? '—'} · ${c.player.positions.join('/')}`,
    href: `/players/${c.player.id}`,
    color: t?.primary_color ?? '#888',
    logo: t?.logo_url ?? null,
    jersey: c.player.jersey_number,
    positions: c.player.positions,
    teamId: t?.id ?? null,
    teamShort: t?.short_name ?? null,
    games_played: c.games_played,
    s: c.s,
  }
}

// ── Aggregate players → team totals ──────────────────────────────────────────
const SUMMABLE = [
  'pass_yards','pass_tds','pass_completions','pass_attempts','interceptions_thrown',
  'total_rush_yards','total_rush_tds','total_rec_yards','total_receptions','rec_tds',
  'total_tds','points','sacks','def_interceptions','fg_made','fg_attempts','ep_made',
]

function aggregateTeams(rows: Computed[]): LeaderEntry[] {
  const map = new Map<string, { team: Team; sums: Record<string, number> }>()
  for (const c of rows) {
    const t = c.player.team
    if (!t) continue
    if (!map.has(t.id)) map.set(t.id, { team: t, sums: Object.fromEntries(SUMMABLE.map(k => [k, 0])) })
    const acc = map.get(t.id)!
    for (const k of SUMMABLE) acc.sums[k] += (c.s[k] ?? 0)
  }
  return [...map.values()].map(({ team, sums }) => {
    const s: Record<string, number | null> = { ...sums }
    s.comp_pct = sums.pass_attempts >= 1 ? Math.round(sums.pass_completions / sums.pass_attempts * 1000) / 10 : null
    s.fg_pct = sums.fg_attempts >= 1 ? Math.round(sums.fg_made / sums.fg_attempts * 1000) / 10 : null
    return {
      id: team.id,
      name: team.name,
      subtitle: '',
      href: `/teams/${team.slug}`,
      color: team.primary_color,
      logo: team.logo_url ?? null,
      jersey: null,
      positions: [],
      teamId: team.id,
      teamShort: team.short_name,
      games_played: 0,
      s,
    }
  })
}

export default async function LeadersPage() {
  const supabase = await createClient()
  const season = await getSelectedSeason()

  const PLAYER_SELECT = 'id,first_name,last_name,jersey_number,positions,team:teams(id,name,short_name,slug,primary_color,logo_url)'

  const { data: careerRows } = await supabase
    .from('career_stats')
    .select(`*, player:players(${PLAYER_SELECT})`)
    .eq('season', season)

  const { data: playoffGames } = await supabase
    .from('games')
    .select('id')
    .eq('season', season)
    .eq('status', 'final')
    .in('game_type', ['wildcard', 'semifinal', 'third_place', 'final'])

  const playoffIds = (playoffGames ?? []).map((g: any) => g.id as string)

  const { data: playoffRows } = playoffIds.length > 0
    ? await supabase.from('game_stats').select(`*, player:players(${PLAYER_SELECT})`).in('game_id', playoffIds)
    : { data: [] as any[] }

  const regular = fromCareerStats(careerRows ?? [])
  const playoff = fromGameStats(playoffRows ?? [])

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          League <span className="text-[#ff1d25]">Leaders</span>
        </h1>
        <p className="text-slate-500 dark:text-[#7a7a7a] text-sm mt-1">
          Bestenlisten je Kategorie · Saison {season}
        </p>
      </div>
      <LeadersClient
        playersRegular={regular.map(toPlayerEntry)}
        playersPlayoff={playoff.map(toPlayerEntry)}
        teamsRegular={aggregateTeams(regular)}
        teamsPlayoff={aggregateTeams(playoff)}
      />
    </div>
  )
}
