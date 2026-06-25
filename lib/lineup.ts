/* ───────────────────────────────────────────────
   Starting-lineup grouping — shared by the lineup
   overlay (/overlay/lineup) and the admin preview/editor
   so the position-group logic lives in ONE place.
─────────────────────────────────────────────── */

export type LineupSide = 'offense' | 'defense'

/* Per-team starters: group_key → ordered player IDs.
   A player can appear in multiple groups (e.g. selected as WR in
   Receivers AND as RB in Backfield). */
export type TeamStarters = {
  offense: Record<string, string[]>
  defense: Record<string, string[]>
}

export type LineupGroup = {
  key: string
  label: string       // shown on the overlay group pill
  positions: string[] // position codes that belong to this group
}

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

export const POSITION_ORDER: Record<string, number> = {
  QB: 1, RB: 2, WR: 3, TE: 4, OL: 5,
  DL: 6, LB: 7, DB: 8,
  K: 9, P: 10,
}

export const STARTER_TARGETS: Record<LineupSide, Record<string, number>> = {
  offense: { QB: 1, RB: 1, WR: 3, TE: 1, OL: 5 },
  defense: { DL: 4, LB: 3, DB: 4 },
}

export type LineupScreen<T> = { group: LineupGroup; players: T[] }

/* Build lineup screens from group-keyed player IDs + a roster lookup.
   Each player appears in every group it was explicitly assigned to.
   Players within a group appear in selection order. */
export function buildLineupScreens<T extends { id: string; positions: string[] }>(
  side: LineupSide,
  groupedIds: Record<string, string[]>,
  roster: T[],
): LineupScreen<T>[] {
  return groupsForSide(side)
    .map(group => {
      const ids = groupedIds[group.key] ?? []
      const players = ids.map(id => roster.find(p => p.id === id)).filter(Boolean) as T[]
      return { group, players }
    })
    .filter(screen => screen.players.length > 0)
}
