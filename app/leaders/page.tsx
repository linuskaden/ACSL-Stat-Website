import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason } from '@/lib/season'
import LeadersClient, { type StatRow } from '@/components/LeadersClient'

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

type PlayerMeta = {
  id: string
  first_name: string
  last_name: string
  jersey_number: number | null
  positions: string[]
  team: { id: string; name: string; short_name: string; slug: string; primary_color: string } | null
}

// ── Add derived / computed fields to a raw stats object ─────────────────────
function computeRow(
  player: PlayerMeta,
  totals: Record<NumField, number>,
  games_played: number,
): StatRow {
  const passAtt = totals.pass_attempts ?? 0
  return {
    player,
    games_played,
    ...totals,
    // combined fields (QB rushes fold in with skill positions)
    total_rush_yards:  (totals.rush_yards ?? 0)  + (totals.qb_rush_yards ?? 0),
    total_rush_tds:    (totals.rush_tds ?? 0)    + (totals.qb_rush_tds ?? 0),
    total_rec_yards:   (totals.rec_yards ?? 0)   + (totals.rb_rec_yards ?? 0),
    total_receptions:  (totals.receptions ?? 0)  + (totals.rb_receptions ?? 0),
    // completion % — null when < 5 attempts (too small a sample)
    comp_pct: passAtt >= 5
      ? Math.round((totals.pass_completions ?? 0) / passAtt * 1000) / 10
      : null,
  }
}

// ── Build StatRows from career_stats rows ────────────────────────────────────
function fromCareerStats(rows: any[]): StatRow[] {
  return rows
    .filter(r => r.player)
    .map(r => {
      const totals = Object.fromEntries(NUM_FIELDS.map(f => [f, r[f] ?? 0])) as Record<NumField, number>
      return computeRow(r.player as PlayerMeta, totals, r.games_played ?? 0)
    })
}

// ── Aggregate game_stats rows (multiple quarters) into per-player totals ─────
function fromGameStats(rows: any[]): StatRow[] {
  const map = new Map<string, { player: PlayerMeta; gameIds: Set<string>; totals: Record<NumField, number> }>()

  for (const row of rows) {
    if (!row.player) continue
    const pid: string = row.player_id
    if (!map.has(pid)) {
      map.set(pid, {
        player: row.player as PlayerMeta,
        gameIds: new Set(),
        totals: Object.fromEntries(NUM_FIELDS.map(f => [f, 0])) as Record<NumField, number>,
      })
    }
    const entry = map.get(pid)!
    entry.gameIds.add(row.game_id as string)
    for (const f of NUM_FIELDS) {
      entry.totals[f] = (entry.totals[f] ?? 0) + (row[f] ?? 0)
    }
  }

  return Array.from(map.values()).map(({ player, gameIds, totals }) =>
    computeRow(player, totals, gameIds.size)
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function LeadersPage() {
  const supabase  = await createClient()
  const season    = await getSelectedSeason()

  const PLAYER_SELECT = 'id,first_name,last_name,jersey_number,positions,team:teams(id,name,short_name,slug,primary_color)'

  // Regular season: career_stats already aggregated by trigger
  const { data: careerRows } = await supabase
    .from('career_stats')
    .select(`*, player:players(${PLAYER_SELECT})`)
    .eq('season', season)

  // Playoff: fetch completed playoff game IDs, then their game_stats
  const { data: playoffGames } = await supabase
    .from('games')
    .select('id')
    .eq('season', season)
    .eq('status', 'final')
    .in('game_type', ['wildcard', 'semifinal', 'third_place', 'final'])

  const playoffIds = (playoffGames ?? []).map((g: any) => g.id as string)

  const { data: playoffRows } = playoffIds.length > 0
    ? await supabase
        .from('game_stats')
        .select(`*, player:players(${PLAYER_SELECT})`)
        .in('game_id', playoffIds)
    : { data: [] as any[] }

  const regularStats = fromCareerStats(careerRows ?? [])
  const playoffStats = fromGameStats(playoffRows ?? [])

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          League <span className="text-[#ff1d25]">Leaders</span>
        </h1>
        <p className="text-slate-500 dark:text-[#7a7a7a] text-sm mt-1">
          Top 5 players in each statistical category · Season {season}
        </p>
      </div>
      <LeadersClient regularStats={regularStats} playoffStats={playoffStats} />
    </div>
  )
}
