import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason } from '@/lib/season'
import { getSelectedCompetition } from '@/lib/competition'
import { LEADER_CATS, LEADER_GROUPS, type StatCat, emptyBballTotals, addBballRow, bballDerived } from '@/lib/sportConfig'
import { notFound } from 'next/navigation'
import TeamPageNav from '@/components/TeamPageNav'
import TeamBand from '@/components/TeamBand'
import TeamStatsTabs, { type StatGroup } from '@/components/TeamStatsTabs'

export const revalidate = 60

const PLAYOFF_TYPES = ['wildcard', 'semifinal', 'third_place', 'final']

const FB_FIELDS = [
  'pass_yards','pass_tds','pass_completions','pass_attempts','interceptions_thrown',
  'qb_rush_yards','qb_rush_tds','rush_yards','rush_tds','rb_rec_yards','rb_receptions',
  'rec_yards','rec_tds','receptions','sacks','def_interceptions','fg_made','fg_attempts','ep_made',
]

type PlayerRow = { player: any; s: Record<string, number | null> }

function footballS(t: Record<string, number>): Record<string, number | null> {
  const passAtt = t.pass_attempts ?? 0
  const total_rush_tds = (t.rush_tds ?? 0) + (t.qb_rush_tds ?? 0)
  const total_tds = total_rush_tds + (t.rec_tds ?? 0)
  return {
    pass_yards: t.pass_yards ?? 0, pass_tds: t.pass_tds ?? 0, pass_attempts: passAtt,
    interceptions_thrown: t.interceptions_thrown ?? 0,
    total_rush_yards: (t.rush_yards ?? 0) + (t.qb_rush_yards ?? 0), total_rush_tds,
    total_rec_yards: (t.rec_yards ?? 0) + (t.rb_rec_yards ?? 0),
    total_receptions: (t.receptions ?? 0) + (t.rb_receptions ?? 0), rec_tds: t.rec_tds ?? 0,
    total_tds, points: total_tds * 6 + (t.fg_made ?? 0) * 3 + (t.ep_made ?? 0),
    sacks: t.sacks ?? 0, def_interceptions: t.def_interceptions ?? 0,
    fg_made: t.fg_made ?? 0, fg_attempts: t.fg_attempts ?? 0, ep_made: t.ep_made ?? 0,
    comp_pct: passAtt >= 5 ? Math.round((t.pass_completions ?? 0) / passAtt * 1000) / 10 : null,
    fg_pct: (t.fg_attempts ?? 0) >= 1 ? Math.round((t.fg_made ?? 0) / t.fg_attempts * 1000) / 10 : null,
  }
}

function aggregate(rows: any[], sport: string): PlayerRow[] {
  const map = new Map<string, { player: any; totals: Record<string, number> }>()
  for (const r of rows) {
    if (!r.player) continue
    if (!map.has(r.player_id)) map.set(r.player_id, { player: r.player, totals: sport === 'basketball' ? emptyBballTotals() : Object.fromEntries(FB_FIELDS.map(k => [k, 0])) })
    const acc = map.get(r.player_id)!
    if (sport === 'basketball') addBballRow(acc.totals, r)
    else for (const k of FB_FIELDS) acc.totals[k] = (acc.totals[k] ?? 0) + (r[k] ?? 0)
  }
  return [...map.values()].map(({ player, totals }) => ({ player, s: sport === 'basketball' ? bballDerived(totals) : footballS(totals) }))
}

function fmtVal(v: number, cat: StatCat): string {
  if (cat.pct) return `${v.toFixed(1)}%`
  if (cat.decimals) return v.toFixed(cat.decimals)
  return String(Math.round(v))
}

function buildGroups(perPlayer: PlayerRow[], cats: StatCat[], groups: string[]): StatGroup[] {
  const leaders = cats.map(cat => {
    const top = perPlayer
      .map(r => ({ r, v: r.s[cat.key] }))
      .filter(x => x.v != null && (x.v as number) > 0 && (!cat.minKey || (x.r.s[cat.minKey] ?? 0) >= (cat.minVal ?? 0)))
      .sort((a, b) => (b.v as number) - (a.v as number))
      .slice(0, 3)
      .map(({ r, v }) => ({
        id: r.player.id as string,
        name: `${r.player.first_name} ${r.player.last_name}`,
        jersey: (r.player.jersey_number ?? null) as number | null,
        value: fmtVal(v as number, cat),
      }))
    return { group: cat.group, abbr: cat.abbr, top }
  }).filter(c => c.top.length > 0)

  return groups
    .map(g => ({ group: g, cats: leaders.filter(l => l.group === g).map(({ abbr, top }) => ({ abbr, top })) }))
    .filter(g => g.cats.length > 0)
}

export default async function TeamStatsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const competition = await getSelectedCompetition()
  const season = await getSelectedSeason(competition)
  const sport = competition.sport

  const { data: team } = await supabase.from('teams').select('*').eq('slug', slug).single()
  if (!team) notFound()

  const { data: seasonGames } = await supabase
    .from('games').select('id, game_type').eq('competition_id', competition.id).eq('season', season)

  const playoffIds = new Set((seasonGames ?? []).filter((g: any) => PLAYOFF_TYPES.includes(g.game_type)).map((g: any) => g.id))
  const allIds = (seasonGames ?? []).map((g: any) => g.id)

  const statsTable = sport === 'basketball' ? 'bball_game_stats' : 'game_stats'
  const { data: statRows } = allIds.length > 0
    ? await supabase.from(statsTable)
        .select('*, player:players(id, first_name, last_name, jersey_number, positions, team_id)')
        .eq('team_id', team.id).in('game_id', allIds)
    : { data: [] as any[] }

  const rows = (statRows ?? []) as any[]
  const cats = LEADER_CATS[sport]
  const groups = LEADER_GROUPS[sport]
  const regular = buildGroups(aggregate(rows.filter(r => !playoffIds.has(r.game_id)), sport), cats, groups)
  const playoff = buildGroups(aggregate(rows.filter(r => playoffIds.has(r.game_id)), sport), cats, groups)

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
