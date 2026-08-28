import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason } from '@/lib/season'
import { getSelectedCompetition } from '@/lib/competition'
import { notFound } from 'next/navigation'
import TeamPageNav from '@/components/TeamPageNav'
import TeamBand from '@/components/TeamBand'
import TeamStatsTabs, { type StatGroup } from '@/components/TeamStatsTabs'

export const revalidate = 60

const PLAYOFF_TYPES = ['wildcard', 'semifinal', 'third_place', 'final']

/* Leader categories (all incl. kicking). Values use merged columns so
   multi-position players count everywhere, consistent with /leaders. */
const CATS: { group: string; abbr: string; get: (r: any) => number | null; fmt?: (v: number) => string }[] = [
  { group: 'Passing',   abbr: 'Pass YDS', get: r => r.pass_yards ?? 0 },
  { group: 'Passing',   abbr: 'Pass TDs', get: r => r.pass_tds ?? 0 },
  { group: 'Passing',   abbr: 'Comp %',   get: r => (r.pass_attempts ?? 0) >= 5 ? (r.pass_completions ?? 0) / r.pass_attempts * 100 : null, fmt: v => `${v.toFixed(1)}%` },
  { group: 'Rushing',   abbr: 'Rush YDS', get: r => (r.rush_yards ?? 0) + (r.qb_rush_yards ?? 0) },
  { group: 'Rushing',   abbr: 'Rush TDs', get: r => (r.rush_tds ?? 0) + (r.qb_rush_tds ?? 0) },
  { group: 'Receiving', abbr: 'Rec YDS',  get: r => (r.rec_yards ?? 0) + (r.rb_rec_yards ?? 0) },
  { group: 'Receiving', abbr: 'Rec',      get: r => (r.receptions ?? 0) + (r.rb_receptions ?? 0) },
  { group: 'Receiving', abbr: 'Rec TDs',  get: r => r.rec_tds ?? 0 },
  { group: 'Defense',   abbr: 'Sacks',    get: r => r.sacks ?? 0, fmt: v => v.toFixed(1) },
  { group: 'Defense',   abbr: 'Def INT',  get: r => r.def_interceptions ?? 0 },
  { group: 'Kicking',   abbr: 'FG',       get: r => r.fg_made ?? 0 },
  { group: 'Kicking',   abbr: 'EP',       get: r => r.ep_made ?? 0 },
  { group: 'Kicking',   abbr: 'PTS',      get: r => (r.fg_made ?? 0) * 3 + (r.ep_made ?? 0) },
]

const NUM_KEYS = [
  'pass_yards', 'pass_attempts', 'pass_completions', 'pass_tds',
  'qb_rush_yards', 'qb_rush_tds', 'rush_yards', 'rush_tds',
  'rb_rec_yards', 'rb_receptions', 'rec_yards', 'receptions', 'rec_tds',
  'sacks', 'def_interceptions', 'fg_made', 'ep_made',
] as const

const GROUP_ORDER = ['Passing', 'Rushing', 'Receiving', 'Defense', 'Kicking']

/* Sum per-game stat rows into one aggregate row per player. */
function aggregate(rows: any[]): any[] {
  const map = new Map<string, any>()
  for (const s of rows) {
    if (!s.player) continue
    if (!map.has(s.player_id)) {
      map.set(s.player_id, { player: s.player })
    }
    const acc = map.get(s.player_id)
    for (const k of NUM_KEYS) acc[k] = (acc[k] ?? 0) + (s[k] ?? 0)
  }
  return [...map.values()]
}

function buildGroups(rows: any[]): StatGroup[] {
  const leaders = CATS.map(cat => {
    const top = rows
      .map((r: any) => ({ r, v: cat.get(r) }))
      .filter((x: any) => x.v != null && x.v > 0)
      .sort((a: any, b: any) => b.v - a.v)
      .slice(0, 3)
      .map(({ r, v }: any) => ({
        id: r.player.id as string,
        name: `${r.player.first_name} ${r.player.last_name}`,
        jersey: (r.player.jersey_number ?? null) as number | null,
        value: cat.fmt ? cat.fmt(v) : String(Math.round(v)),
      }))
    return { group: cat.group, abbr: cat.abbr, top }
  }).filter(c => c.top.length > 0)

  return GROUP_ORDER
    .map(g => ({ group: g, cats: leaders.filter(l => l.group === g).map(({ abbr, top }) => ({ abbr, top })) }))
    .filter(g => g.cats.length > 0)
}

export default async function TeamStatsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const competition = await getSelectedCompetition()
  const season = await getSelectedSeason(competition)

  const { data: team } = await supabase.from('teams').select('*').eq('slug', slug).single()
  if (!team) notFound()

  const { data: seasonGames } = await supabase
    .from('games').select('id, game_type').eq('competition_id', competition.id).eq('season', season)

  const playoffIds = new Set((seasonGames ?? []).filter((g: any) => PLAYOFF_TYPES.includes(g.game_type)).map((g: any) => g.id))
  const allIds = (seasonGames ?? []).map((g: any) => g.id)

  const { data: statRows } = allIds.length > 0
    ? await supabase
        .from('game_stats')
        .select('*, player:players(id, first_name, last_name, jersey_number, positions, team_id)')
        .eq('team_id', team.id)
        .in('game_id', allIds)
    : { data: [] as any[] }

  const rows = (statRows ?? []) as any[]
  const regularRows = rows.filter(r => !playoffIds.has(r.game_id))
  const playoffRows = rows.filter(r => playoffIds.has(r.game_id))

  const regular = buildGroups(aggregate(regularRows))
  const playoff = buildGroups(aggregate(playoffRows))

  const primary = team.primary_color || '#111'

  return (
    <div>
      <TeamBand team={team} subtitle={`Team-Statistiken · Saison ${season}`} />
      <TeamPageNav slug={slug} primary={primary} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <TeamStatsTabs regular={regular} playoff={playoff} primary={primary} />
      </div>
    </div>
  )
}
