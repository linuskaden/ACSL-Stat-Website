import type { Sport } from './competition-client'

/* Per-sport UI config: roster positions and leaderboard stat categories.
   Client-safe (pure data). Football keeps its existing keys; basketball uses
   the bball_game_stats-derived keys. */

export const POSITIONS: Record<Sport, string[]> = {
  football: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'],
  basketball: ['PG', 'SG', 'SF', 'PF', 'C'],
}

export type StatCat = {
  key: string
  label: string
  abbr: string
  group: string
  pct?: boolean
  decimals?: number
  noPerGame?: boolean
  minKey?: string
  minVal?: number
}

const FOOTBALL_CATS: StatCat[] = [
  { key: 'pass_yards',          label: 'Passing Yards',   abbr: 'Pass Yds', group: 'Passing' },
  { key: 'pass_tds',            label: 'Passing TDs',     abbr: 'Pass TDs', group: 'Passing' },
  { key: 'comp_pct',            label: 'Completion %',    abbr: 'Comp %',   group: 'Passing', pct: true, noPerGame: true, minKey: 'pass_attempts', minVal: 5 },
  { key: 'interceptions_thrown',label: 'INTs Thrown',     abbr: 'INT',      group: 'Passing' },
  { key: 'total_rush_yards',    label: 'Rushing Yards',   abbr: 'Rush Yds', group: 'Rushing' },
  { key: 'total_rush_tds',      label: 'Rushing TDs',     abbr: 'Rush TDs', group: 'Rushing' },
  { key: 'total_rec_yards',     label: 'Receiving Yards', abbr: 'Rec Yds',  group: 'Receiving' },
  { key: 'total_receptions',    label: 'Receptions',      abbr: 'Rec',      group: 'Receiving' },
  { key: 'rec_tds',             label: 'Receiving TDs',   abbr: 'Rec TDs',  group: 'Receiving' },
  { key: 'total_tds',           label: 'Total TDs',       abbr: 'TDs',      group: 'Scoring' },
  { key: 'points',              label: 'Points',          abbr: 'PTS',      group: 'Scoring' },
  { key: 'sacks',               label: 'Sacks',           abbr: 'Sacks',    group: 'Defense', decimals: 1 },
  { key: 'def_interceptions',   label: 'Interceptions',   abbr: 'Def INT',  group: 'Defense' },
  { key: 'fg_made',             label: 'Field Goals',     abbr: 'FG',       group: 'Kicking' },
  { key: 'ep_made',             label: 'Extra Points',    abbr: 'XP',       group: 'Kicking' },
  { key: 'fg_pct',              label: 'FG %',            abbr: 'FG %',     group: 'Kicking', pct: true, noPerGame: true, minKey: 'fg_attempts', minVal: 1 },
]

const BASKETBALL_CATS: StatCat[] = [
  { key: 'pts',         label: 'Points',           abbr: 'PTS', group: 'Scoring' },
  { key: 'reb',         label: 'Rebounds',         abbr: 'REB', group: 'Rebounding' },
  { key: 'assists',     label: 'Assists',          abbr: 'AST', group: 'Playmaking' },
  { key: 'fg_made',     label: 'Field Goals Made', abbr: 'FGM', group: 'Shooting' },
  { key: 'fg_pct',      label: 'FG %',             abbr: 'FG %', group: 'Shooting', pct: true, noPerGame: true, minKey: 'fg_att', minVal: 10 },
  { key: 'three_made',  label: '3-Pointers Made',  abbr: '3PM', group: 'Shooting' },
  { key: 'three_pct',   label: '3P %',             abbr: '3P %', group: 'Shooting', pct: true, noPerGame: true, minKey: 'three_att', minVal: 5 },
  { key: 'ft_pct',      label: 'FT %',             abbr: 'FT %', group: 'Shooting', pct: true, noPerGame: true, minKey: 'ft_att', minVal: 5 },
]

export const LEADER_CATS: Record<Sport, StatCat[]> = {
  football: FOOTBALL_CATS,
  basketball: BASKETBALL_CATS,
}

export const LEADER_GROUPS: Record<Sport, string[]> = {
  football: ['Passing', 'Rushing', 'Receiving', 'Scoring', 'Defense', 'Kicking'],
  basketball: ['Scoring', 'Rebounding', 'Playmaking', 'Shooting'],
}

/* Aggregate raw bball_game_stats rows into one totals object per key, with
   derived pts and shooting percentages. Used by the basketball leaders,
   team-stats and box-score builders. */
const BB_RAW = ['fg_made', 'fg_att', 'three_made', 'three_att', 'ft_made', 'ft_att', 'reb', 'assists'] as const

export function emptyBballTotals(): Record<string, number> {
  return Object.fromEntries(BB_RAW.map(k => [k, 0]))
}

export function addBballRow(acc: Record<string, number>, row: any): void {
  for (const k of BB_RAW) acc[k] = (acc[k] ?? 0) + (row[k] ?? 0)
}

/** Finalize a totals object into the stat record used by the leader categories. */
export function bballDerived(t: Record<string, number>): Record<string, number | null> {
  const fgm = t.fg_made ?? 0, tpm = t.three_made ?? 0, ftm = t.ft_made ?? 0
  return {
    ...t,
    pts: 2 * fgm + tpm + ftm,           // FGM includes 3PM, so 2*FGM + 3PM + FTM
    fg_pct: t.fg_att >= 1 ? Math.round(fgm / t.fg_att * 1000) / 10 : null,
    three_pct: t.three_att >= 1 ? Math.round(tpm / t.three_att * 1000) / 10 : null,
    ft_pct: t.ft_att >= 1 ? Math.round(ftm / t.ft_att * 1000) / 10 : null,
  }
}
