'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type LineupSide } from '@/lib/lineup'
import LineupFullPanel, { type LineupFullPlayer, type LineupFullTeam } from '@/components/LineupFullPanel'

const SEASON = 2026

type LineupFullStateRow = {
  id: number
  team_id: string | null
  side: LineupSide
  visible: boolean
}

/* ════════════════════════════════════════════
   Full-screen starting-lineup overlay — shows every
   position group of the selected unit at once.
════════════════════════════════════════════ */
export default function LineupFullOverlay() {
  const [team, setTeam] = useState<LineupFullTeam | null>(null)
  const [players, setPlayers] = useState<LineupFullPlayer[]>([])
  const [side, setSide] = useState<LineupSide>('offense')
  const [visible, setVisible] = useState(false)

  const teamIdRef = useRef<string | null>(null)
  const sideRef = useRef<LineupSide>('offense')

  useEffect(() => {
    const supabase = createClient()

    async function loadLineup() {
      const teamId = teamIdRef.current
      if (!teamId) { setTeam(null); setPlayers([]); return }

      const [{ data: t }, { data: starters }] = await Promise.all([
        supabase.from('teams').select('short_name, name, primary_color, logo_url').eq('id', teamId).single(),
        supabase.from('team_starters').select('offense, defense').eq('team_id', teamId).eq('season', SEASON).maybeSingle(),
      ])
      setTeam((t as LineupFullTeam) ?? null)

      const ids: string[] = (sideRef.current === 'offense' ? starters?.offense : starters?.defense) ?? []
      if (ids.length === 0) { setPlayers([]); return }

      const { data: ps } = await supabase
        .from('players')
        .select('id, first_name, last_name, jersey_number, positions')
        .in('id', ids)

      const ordered = ids
        .map(id => (ps ?? []).find((p: any) => p.id === id))
        .filter(Boolean) as LineupFullPlayer[]
      setPlayers(ordered)
    }

    async function loadState(newState?: LineupFullStateRow) {
      let state = newState
      if (!state) {
        const { data } = await supabase.from('lineup_full_overlay_state').select('*').eq('id', 1).single()
        if (!data) return
        state = data as LineupFullStateRow
      }
      setVisible(state.visible)
      setSide(state.side)
      teamIdRef.current = state.team_id
      sideRef.current = state.side
      await loadLineup()
    }

    loadState()

    const ch = supabase.channel('lineup-full-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineup_full_overlay_state' },
        ({ new: row }) => loadState(row as LineupFullStateRow))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_starters' },
        () => loadLineup())
      // Mutual exclusion: hide when another big graphic goes live
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overlay_state' },
        ({ new: row }: any) => { if (row?.visible === true) setVisible(false) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_overlay_state' },
        ({ new: row }: any) => { if (row?.visible === true) setVisible(false) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineup_overlay_state' },
        ({ new: row }: any) => { if (row?.visible === true) setVisible(false) })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  return <LineupFullPanel team={team} side={side} players={players} visible={visible} />
}
