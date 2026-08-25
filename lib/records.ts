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
