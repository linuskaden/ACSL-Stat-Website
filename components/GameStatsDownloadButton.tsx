'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  gameId: string
  label: string  // e.g. "RAI-vs-TIG" — used in filename
}

const STAT_FIELDS = [
  'pass_yards', 'pass_completions', 'pass_attempts', 'pass_tds', 'interceptions_thrown',
  'qb_rush_yards', 'qb_rush_tds',
  'rush_carries', 'rush_yards', 'rush_tds',
  'rec_yards', 'receptions', 'rec_tds', 'rec_targets',
  'sacks', 'def_interceptions',
  'fg_made', 'fg_attempts', 'ep_made', 'ep_attempts',
] as const

const CSV_HEADER =
  'Team,#,Name,Pos,Pass YDS,Comp,Att,Pass TDs,INT,QB Rush YDS,QB Rush TDs,Carries,Rush YDS,Rush TDs,Rec YDS,Rec,Rec TDs,Targets,Sacks,DEF INT,FGM,FGA,EPM,EPA'

function esc(v: string): string {
  return v.includes(',') ? `"${v}"` : v
}

export default function GameStatsDownloadButton({ gameId, label }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const supabase = createClient()

      // 1. Fetch all game_stats rows for this game
      const { data: statRows } = await supabase
        .from('game_stats')
        .select('*')
        .eq('game_id', gameId)

      if (!statRows || statRows.length === 0) {
        alert('No stats recorded for this game yet.')
        return
      }

      // 2. Unique player IDs
      const playerIds = [...new Set(statRows.map((r: any) => r.player_id))]

      // 3. Fetch players
      const { data: players } = await supabase
        .from('players')
        .select('id, first_name, last_name, jersey_number, positions, team_id')
        .in('id', playerIds)

      // 4. Fetch teams
      const teamIds = [...new Set((players ?? []).map((p: any) => p.team_id).filter(Boolean))]
      const { data: teams } = teamIds.length > 0
        ? await supabase.from('teams').select('id, short_name').in('id', teamIds)
        : { data: [] }

      const teamMap = new Map((teams ?? []).map((t: any) => [t.id, t.short_name as string]))
      const playerMap = new Map((players ?? []).map((p: any) => [p.id, p]))

      // 5. Aggregate stat rows by player_id (sum all quarters)
      const aggregated = new Map<string, Record<string, number>>()
      for (const row of statRows) {
        if (!aggregated.has(row.player_id)) {
          aggregated.set(row.player_id, Object.fromEntries(STAT_FIELDS.map(f => [f, 0])))
        }
        const acc = aggregated.get(row.player_id)!
        for (const f of STAT_FIELDS) {
          acc[f] = (acc[f] ?? 0) + ((row as any)[f] ?? 0)
        }
      }

      // 6. Sort by team, then jersey number
      const sortedEntries = [...aggregated.entries()].sort((a, b) => {
        const pa = playerMap.get(a[0])
        const pb = playerMap.get(b[0])
        const ta = pa?.team_id ? (teamMap.get(pa.team_id) ?? '') : ''
        const tb = pb?.team_id ? (teamMap.get(pb.team_id) ?? '') : ''
        if (ta !== tb) return ta.localeCompare(tb)
        return (pa?.jersey_number ?? 999) - (pb?.jersey_number ?? 999)
      })

      // 7. Build CSV rows
      const rows = sortedEntries.map(([playerId, s]) => {
        const p = playerMap.get(playerId)
        const teamShort = p?.team_id ? (teamMap.get(p.team_id) ?? '') : ''
        const jersey = p?.jersey_number ?? ''
        const name = p ? `${p.first_name[0]}. ${p.last_name}` : playerId.slice(0, 8)
        const pos = (p?.positions ?? []).join('/')

        return [
          esc(teamShort),
          jersey,
          esc(name),
          esc(pos),
          ...STAT_FIELDS.map(f => s[f] ?? 0),
        ].join(',')
      })

      // 8. Trigger browser download
      const csv = [CSV_HEADER, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `game-stats-${label}.csv`
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
      title="Download game stats as CSV"
      className="text-xs text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white border border-black/10 dark:border-white/10 px-2 py-1 rounded transition-colors disabled:opacity-40 shrink-0"
    >
      {loading ? '…' : '↓ CSV'}
    </button>
  )
}
