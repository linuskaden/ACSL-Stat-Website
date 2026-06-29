'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcYPC, calcYPR, calcCompPct } from '@/lib/utils'

interface Props {
  gameId: string
  label: string  // e.g. "RAI-vs-TIG" — used in filename
}

type Stat = Record<string, number>

/* Merge duplicate columns for the same real stat so a value shows regardless of
   which position column it was entered under (QB-rush vs RB-rush etc.). */
function val(s: Stat, f: string): number {
  switch (f) {
    case 'rush_yards':
    case 'qb_rush_yards':  return (s.rush_yards ?? 0) + (s.qb_rush_yards ?? 0)
    case 'rush_tds':
    case 'qb_rush_tds':    return (s.rush_tds ?? 0) + (s.qb_rush_tds ?? 0)
    case 'rec_yards':
    case 'rb_rec_yards':   return (s.rec_yards ?? 0) + (s.rb_rec_yards ?? 0)
    case 'receptions':
    case 'rb_receptions':  return (s.receptions ?? 0) + (s.rb_receptions ?? 0)
    case 'rec_targets':
    case 'rb_targets':     return (s.rec_targets ?? 0) + (s.rb_targets ?? 0)
    default:               return s[f] ?? 0
  }
}

type Col = { h: string; v: (s: Stat) => number | string }

/* Position groups mirror the live stats tracker — same sections, same columns
   (including the grey auto-calculated columns). A multi-position player appears
   under every group that matches one of their positions. */
const GROUPS: { title: string; has: (pos: string[]) => boolean; cols: Col[] }[] = [
  {
    title: 'Quarterbacks',
    has: pos => pos.includes('QB'),
    cols: [
      { h: 'Pass YDS', v: s => val(s, 'pass_yards') },
      { h: 'Comp', v: s => val(s, 'pass_completions') },
      { h: 'Att', v: s => val(s, 'pass_attempts') },
      { h: 'Pass TD', v: s => val(s, 'pass_tds') },
      { h: 'INT', v: s => val(s, 'interceptions_thrown') },
      { h: 'Rush YDS', v: s => val(s, 'rush_yards') },
      { h: 'Carries', v: s => val(s, 'rush_carries') },
      { h: 'Rush TD', v: s => val(s, 'rush_tds') },
      { h: 'Fumbles', v: s => val(s, 'qb_fumbles') },
      { h: 'Total YDS', v: s => val(s, 'pass_yards') + val(s, 'rush_yards') },
      { h: 'Total TD', v: s => val(s, 'pass_tds') + val(s, 'rush_tds') },
      { h: 'Y/Comp', v: s => calcYPC(val(s, 'pass_yards'), val(s, 'pass_completions')) },
      { h: 'Comp%', v: s => calcCompPct(val(s, 'pass_completions'), val(s, 'pass_attempts')) },
    ],
  },
  {
    title: 'Running Backs',
    has: pos => pos.includes('RB'),
    cols: [
      { h: 'Carries', v: s => val(s, 'rush_carries') },
      { h: 'Rush YDS', v: s => val(s, 'rush_yards') },
      { h: 'Rush TD', v: s => val(s, 'rush_tds') },
      { h: 'Rec YDS', v: s => val(s, 'rec_yards') },
      { h: 'Rec', v: s => val(s, 'receptions') },
      { h: 'Tar', v: s => val(s, 'rec_targets') },
      { h: 'Fumbles', v: s => val(s, 'rb_fumbles') },
      { h: 'YPC', v: s => calcYPC(val(s, 'rush_yards'), val(s, 'rush_carries')) },
    ],
  },
  {
    title: 'Receivers (WR / TE)',
    has: pos => pos.includes('WR') || pos.includes('TE'),
    cols: [
      { h: 'Rec YDS', v: s => val(s, 'rec_yards') },
      { h: 'Rec', v: s => val(s, 'receptions') },
      { h: 'Tar', v: s => val(s, 'rec_targets') },
      { h: 'Rec TD', v: s => val(s, 'rec_tds') },
      { h: 'Fumbles', v: s => val(s, 'rec_fumbles') },
      { h: 'YPR', v: s => calcYPR(val(s, 'rec_yards'), val(s, 'receptions')) },
    ],
  },
  {
    title: 'Kicker / Punter',
    has: pos => pos.includes('K') || pos.includes('P'),
    cols: [
      { h: 'FGM', v: s => val(s, 'fg_made') },
      { h: 'FGA', v: s => val(s, 'fg_attempts') },
      { h: 'EPM', v: s => val(s, 'ep_made') },
      { h: 'EPA', v: s => val(s, 'ep_attempts') },
      { h: 'PTS', v: s => val(s, 'fg_made') * 3 + val(s, 'ep_made') },
    ],
  },
  {
    title: 'Defense',
    has: pos => pos.some(p => ['DB', 'DL', 'LB'].includes(p)),
    cols: [
      { h: 'Tackles', v: s => val(s, 'def_tackles') },
      { h: 'Sacks', v: s => val(s, 'sacks') },
      { h: 'INT', v: s => val(s, 'def_interceptions') },
      { h: 'TD', v: s => val(s, 'def_tds') },
      { h: 'Fum Rec', v: s => val(s, 'def_fumble_recovered') },
    ],
  },
]

const HEADER_FILL = 'FFE5E7EB'
const SECTION_FILL = 'FF1F2937'

function safeSheetName(name: string): string {
  return (name || 'Team').replace(/[\\/?*[\]:]/g, '').slice(0, 31)
}

export default function GameStatsDownloadButton({ gameId, label }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const supabase = createClient()

      const [{ data: game }, { data: statRows }] = await Promise.all([
        supabase.from('games')
          .select('home_score, away_score, home_team:teams!games_home_team_id_fkey(id, name, short_name), away_team:teams!games_away_team_id_fkey(id, name, short_name)')
          .eq('id', gameId).single(),
        supabase.from('game_stats').select('*').eq('game_id', gameId),
      ])

      if (!statRows || statRows.length === 0) { alert('Für dieses Spiel sind noch keine Stats erfasst.'); return }
      if (!game) { alert('Spiel nicht gefunden.'); return }

      // Players that have stats in this game
      const playerIds = [...new Set(statRows.map((r: any) => r.player_id))]
      const { data: players } = await supabase
        .from('players')
        .select('id, first_name, last_name, jersey_number, positions, team_id')
        .in('id', playerIds)
      const playerList = (players ?? []) as any[]

      // Aggregate all numeric stat fields per player (sum across quarters)
      const agg = new Map<string, Stat>()
      for (const row of statRows as any[]) {
        const cur = agg.get(row.player_id) ?? {}
        for (const [k, v] of Object.entries(row)) if (typeof v === 'number') cur[k] = (cur[k] ?? 0) + v
        agg.set(row.player_id, cur)
      }

      const home = (game as any).home_team
      const away = (game as any).away_team
      const sides = [
        { team: home, score: (game as any).home_score ?? 0, other: away, otherScore: (game as any).away_score ?? 0 },
        { team: away, score: (game as any).away_score ?? 0, other: home, otherScore: (game as any).home_score ?? 0 },
      ]

      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = 'ACSL Stats'
      wb.created = new Date()

      for (const side of sides) {
        if (!side.team) continue
        const ws = wb.addWorksheet(safeSheetName(side.team.short_name ?? side.team.name))
        const teamPlayers = playerList.filter(p => p.team_id === side.team.id)

        // Title + final score
        const title = ws.addRow([`${side.team.name ?? side.team.short_name}`])
        title.getCell(1).font = { bold: true, size: 14 }
        const score = ws.addRow([`${side.team.short_name} ${side.score} : ${side.otherScore} ${side.other?.short_name ?? ''}`])
        score.getCell(1).font = { size: 11, color: { argb: 'FF6B7280' } }
        ws.addRow([])

        for (const g of GROUPS) {
          const members = teamPlayers
            .filter(p => g.has((p.positions ?? []) as string[]))
            .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999))
          if (members.length === 0) continue

          const width = 3 + g.cols.length

          // Section title (filled bar)
          const secRow = ws.addRow([g.title])
          for (let i = 1; i <= width; i++) {
            secRow.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_FILL } }
          }
          secRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } }

          // Header row
          const hRow = ws.addRow(['#', 'Name', 'Pos', ...g.cols.map(c => c.h)])
          hRow.eachCell((c, col) => {
            c.font = { bold: true, size: 10 }
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
            c.alignment = { horizontal: col === 2 ? 'left' : 'center' }
            c.border = { bottom: { style: 'thin', color: { argb: 'FFB0B7C3' } } }
          })

          // Player rows
          for (const p of members) {
            const s = agg.get(p.id) ?? {}
            const row = ws.addRow([
              p.jersey_number ?? '',
              `${p.first_name} ${p.last_name}`,
              ((p.positions ?? []) as string[]).join('/'),
              ...g.cols.map(c => c.v(s)),
            ])
            row.getCell(1).alignment = { horizontal: 'center' }
            row.getCell(3).alignment = { horizontal: 'center' }
            g.cols.forEach((_, i) => { row.getCell(4 + i).alignment = { horizontal: 'center' } })
          }

          ws.addRow([])  // spacer between groups
        }

        // Column widths
        ws.getColumn(1).width = 5
        ws.getColumn(2).width = 24
        ws.getColumn(3).width = 10
        for (let i = 4; i <= 18; i++) ws.getColumn(i).width = 9
      }

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `game-stats-${label}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      title="Spielbericht als Excel (XLSX) herunterladen"
      className="text-xs text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white border border-black/10 dark:border-white/10 px-2 py-1 rounded transition-colors disabled:opacity-40 shrink-0"
    >
      {loading ? '…' : '↓ XLSX'}
    </button>
  )
}
