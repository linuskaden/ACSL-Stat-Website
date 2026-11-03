import type { Player } from './supabase/types'

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

/** Academic-year label for a season int: 2027 -> "2026/27", 2026 -> "2025/26". */
export function seasonLabel(season: number | null | undefined): string {
  if (!season) return ''
  return `${season - 1}/${String(season).slice(-2)}`
}

export function getPlayerDisplayName(player: Player) {
  return `${player.first_name} ${player.last_name}`
}

export function getPlayerPositions(player: Player): string {
  return player.positions.join(' / ')
}

export function calcYPA(yards: number, attempts: number): string {
  if (!attempts) return '0.0'
  return (yards / attempts).toFixed(1)
}

export function calcYPC(yards: number, carries: number): string {
  if (!carries) return '0.0'
  return (yards / carries).toFixed(1)
}

export function calcYPR(yards: number, receptions: number): string {
  if (!receptions) return '0.0'
  return (yards / receptions).toFixed(1)
}

export function calcCompPct(completions: number, attempts: number): string {
  if (!attempts) return '0.0%'
  return ((completions / attempts) * 100).toFixed(1) + '%'
}

export function calcKickerPoints(fgMade: number, epMade: number): number {
  return fgMade * 3 + epMade * 1
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Vienna' })
}

/** Age in whole years from a date-only birthdate ("YYYY-MM-DD"), or null if unparseable. */
export function calcAge(dob: string | null): number | null {
  if (!dob) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob)
  if (!m) return null
  const y = +m[1], mo = +m[2], d = +m[3]
  const now = new Date()
  let age = now.getFullYear() - y
  const beforeBirthday = now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)
  if (beforeBirthday) age--
  return age >= 0 && age < 120 ? age : null
}

/** Format a date-only birthdate ("YYYY-MM-DD") as "DD.MM.YYYY (age)". Parsed by
    parts to avoid timezone shifts on date-only values. */
export function formatBirthdate(dob: string | null): string {
  if (!dob) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob)
  if (!m) return '—'
  const age = calcAge(dob)
  return `${m[3]}.${m[2]}.${m[1]}${age != null ? ` (${age})` : ''}`
}

export function formatGameTime(iso: string | null): string {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleString('de-AT', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna'
  })
}

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'OT'] as const
export type Quarter = typeof QUARTERS[number]

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'] as const

export function isQB(positions: string[]) { return positions.includes('QB') }
export function isRB(positions: string[]) { return positions.includes('RB') }
export function isReceiver(positions: string[]) { return positions.some(p => ['WR', 'TE'].includes(p)) }
export function isDefensive(positions: string[]) { return positions.some(p => ['DL', 'LB', 'DB'].includes(p)) }
export function isKicker(positions: string[]) { return positions.some(p => ['K', 'P'].includes(p)) }
