import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason } from '@/lib/season'
import { notFound } from 'next/navigation'
import TeamRosterGrid, { type LeaderCat } from '@/components/TeamRosterGrid'

export const revalidate = 60

/* Team-leader categories (all incl. kicking). Values use merged columns so
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

function buildLeaders(rows: any[]): LeaderCat[] {
  return CATS.map(cat => {
    const ranked = rows
      .map(r => ({ r, v: cat.get(r) }))
      .filter(x => x.v != null && (x.v as number) > 0)
      .sort((a, b) => (b.v as number) - (a.v as number))
      .slice(0, 3)
      .map(({ r, v }) => ({
        id: r.player.id as string,
        name: `${r.player.first_name} ${r.player.last_name}`,
        jersey: (r.player.jersey_number ?? null) as number | null,
        value: cat.fmt ? cat.fmt(v as number) : String(Math.round(v as number)),
      }))
    return { group: cat.group, abbr: cat.abbr, top: ranked }
  }).filter(c => c.top.length > 0)
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const season = await getSelectedSeason()

  const [{ data: team }, { data: allTeams }] = await Promise.all([
    supabase.from('teams').select('*').eq('slug', slug).single(),
    supabase.from('teams').select('*').order('name'),
  ])

  if (!team) notFound()

  const [{ data: players }, { data: careerRows }] = await Promise.all([
    supabase
      .from('players')
      .select('*')
      .eq('team_id', team.id)
      .eq('is_active', true)
      .order('jersey_number', { nullsFirst: false }),
    supabase
      .from('career_stats')
      .select('*, player:players!inner(id, first_name, last_name, jersey_number, positions, team_id)')
      .eq('season', season),
  ])

  const teamCareer = (careerRows ?? []).filter((r: any) => r.player?.team_id === team.id)
  const leaders = buildLeaders(teamCareer)

  return (
    <TeamRosterGrid
      team={team as any}
      players={(players ?? []) as any[]}
      allTeams={(allTeams ?? []) as any[]}
      leaders={leaders}
      season={season}
    />
  )
}
