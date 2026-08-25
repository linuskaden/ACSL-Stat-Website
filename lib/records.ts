/**
 * Team W-L records — REGULAR SEASON only.
 * Playoff results never count toward a team's record.
 * Only finished games with both scores are tallied.
 */
export function computeRecords(games: any[]): Record<string, string> {
  const wl: Record<string, { w: number; l: number }> = {}
  for (const g of games ?? []) {
    if (g.game_type !== 'regular_season') continue
    if (g.status !== 'final' || g.home_score == null || g.away_score == null) continue
    if (!wl[g.home_team_id]) wl[g.home_team_id] = { w: 0, l: 0 }
    if (!wl[g.away_team_id]) wl[g.away_team_id] = { w: 0, l: 0 }
    if (g.home_score > g.away_score) { wl[g.home_team_id].w++; wl[g.away_team_id].l++ }
    else if (g.home_score < g.away_score) { wl[g.home_team_id].l++; wl[g.away_team_id].w++ }
  }
  const recordByTeam: Record<string, string> = {}
  for (const [id, r] of Object.entries(wl)) recordByTeam[id] = `${r.w}-${r.l}`
  return recordByTeam
}

export type FormResult = 'W' | 'L' | 'T'

/**
 * Recent form per team — the last `lastN` finished REGULAR SEASON games,
 * in chronological order (oldest → newest). Playoffs never count.
 */
export function computeForm(games: any[], lastN = 3): Record<string, FormResult[]> {
  const finals = (games ?? [])
    .filter(g =>
      g.game_type === 'regular_season' &&
      g.status === 'final' &&
      g.home_score != null &&
      g.away_score != null,
    )
    .sort((a, b) =>
      new Date(a.scheduled_at ?? 0).getTime() - new Date(b.scheduled_at ?? 0).getTime(),
    )

  const byTeam: Record<string, FormResult[]> = {}
  for (const g of finals) {
    const home = g.home_score as number
    const away = g.away_score as number
    const homeRes: FormResult = home > away ? 'W' : home < away ? 'L' : 'T'
    const awayRes: FormResult = home > away ? 'L' : home < away ? 'W' : 'T'
    if (!byTeam[g.home_team_id]) byTeam[g.home_team_id] = []
    if (!byTeam[g.away_team_id]) byTeam[g.away_team_id] = []
    byTeam[g.home_team_id].push(homeRes)
    byTeam[g.away_team_id].push(awayRes)
  }

  const out: Record<string, FormResult[]> = {}
  for (const [id, arr] of Object.entries(byTeam)) out[id] = arr.slice(-lastN)
  return out
}
