/* ───────────────────────────────────────────────
   Starting-lineup grouping — shared by the lineup
   overlay (/overlay/lineup) and the admin preview/editor
   so the position-group logic lives in ONE place.
─────────────────────────────────────────────── */

export type LineupSide = 'offense' | 'defense'

export type LineupGroup = {
  key: string
  label: string       // shown on the overlay group pill
  positions: string[] // primary-position codes that belong to this group
}

/* Offense / Defense are each split into 3 broadcast-style screens.
   Grouping is by PRIMARY position (positions[0]) — matches the rest of the app. */
export const OFFENSE_GROUPS: LineupGroup[] = [
  { key: 'backfield', label: 'Backfield',       positions: ['QB', 'RB'] },
  { key: 'receivers', label: 'Receivers',       positions: ['WR', 'TE'] },
  { key: 'oline',     label: 'Offensive Line',  positions: ['OL'] },
]

export const DEFENSE_GROUPS: LineupGroup[] = [
  { key: 'dline',       label: 'Defensive Line', positions: ['DL'] },
  { key: 'linebackers', label: 'Linebackers',    positions: ['LB'] },
  { key: 'secondary',   label: 'Secondary',      positions: ['DB'] },
]

export function groupsForSide(side: LineupSide): LineupGroup[] {
  return side === 'offense' ? OFFENSE_GROUPS : DEFENSE_GROUPS
}

/* The fixed order in which position groups are auto-filled / sorted. */
export const POSITION_ORDER: Record<string, number> = {
  QB: 1, RB: 2, WR: 3, TE: 4, OL: 5,
  DL: 6, LB: 7, DB: 8,
  K: 9, P: 10,
}

/* Target starter counts per primary position (used by the editor's Auto-Fill). */
export const STARTER_TARGETS: Record<LineupSide, Record<string, number>> = {
  offense: { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5 },
  defense: { DL: 4, LB: 3, DB: 4 },
}

export type LineupScreen<T> = { group: LineupGroup; players: T[] }

/* Split an ordered list of starters into the (non-empty) group screens for a side.
   `players` must already be in selection order; order is preserved within a group. */
export function buildLineupScreens<T extends { positions: string[] }>(
  side: LineupSide,
  players: T[],
): LineupScreen<T>[] {
  return groupsForSide(side)
    .map(group => ({
      group,
      players: players.filter(p => group.positions.includes(p.positions[0] ?? '')),
    }))
    .filter(screen => screen.players.length > 0)
}
