import type { Player } from './supabase/types'

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
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
  return new Date(iso).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatGameTime(iso: string | null): string {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleString('de-AT', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
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
