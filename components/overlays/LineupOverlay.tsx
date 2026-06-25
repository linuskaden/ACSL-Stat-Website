'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildLineupScreens, type LineupSide } from '@/lib/lineup'
import LineupBand, { type LineupBandPlayer, type LineupBandTeam } from '@/components/LineupBand'
import LineupFullPanel from '@/components/LineupFullPanel'

const SEASON = 2026

type LineupStyle = 'band' | 'full'
type LineupStateRow = {
  id: number
  team_id: string | null
  side: LineupSide
  rotation_seconds: number
  visible: boolean
  display_style: LineupStyle
}

/* ════════════════════════════════════════════
   Starting-lineup overlay — one vMix input, two styles:
   a rotating bottom band or a full-screen panel
   (chosen via display_style). Both read the same data.
════════════════════════════════════════════ */
export default function LineupOverlay() {
  const [team, setTeam] = useState<LineupBandTeam | null>(null)
  const [roster, setRoster] = useState<LineupBandPlayer[]>([])
  const [groupedIds, setGroupedIds] = useState<Record<string, string[]>>({})
  const [side, setSide] = useState<LineupSide>('offense')
  const [style, setStyle] = useState<LineupStyle>('band')
  const [visible, setVisible] = useState(false)
  const [rotationMs, setRotationMs] = useState(8000)
  const [idx, setIdx] = useState(0)
  const [shown, setShown] = useState(true)

  const teamIdRef = useRef<string | null>(null)
  const sideRef = useRef<LineupSide>('offense')

  useEffect(() => {
    const supabase = createClient()

    async function loadLineup() {
      const teamId = teamIdRef.current
      if (!teamId) { setTeam(null); setRoster([]); setGroupedIds({}); return }

      const [{ data: t }, { data: starters }] = await Promise.all([
        supabase.from('teams').select('short_name, name, primary_color, logo_url').eq('id', teamId).single(),
        supabase.from('team_starters').select('offense, defense').eq('team_id', teamId).eq('season', SEASON).maybeSingle(),
      ])
      setTeam((t as LineupBandTeam) ?? null)

      const gIds: Record<string, string[]> = (sideRef.current === 'offense' ? starters?.offense : starters?.defense) ?? {}
      setGroupedIds(gIds)
      const ids = Object.values(gIds).flat()
      if (ids.length === 0) { setRoster([]); return }

      const { data: ps } = await supabase
        .from('players')
        .select('id, first_name, last_name, jersey_number, positions')
        .in('id', ids)
      setRoster((ps ?? []) as LineupBandPlayer[])
    }

    async function loadState(newState?: LineupStateRow) {
      let state = newState
      if (!state) {
        const { data } = await supabase.from('lineup_overlay_state').select('*').eq('id', 1).single()
        if (!data) return
        state = data as LineupStateRow
      }
      setVisible(state.visible)
      setSide(state.side)
      setStyle(state.display_style ?? 'band')
      setRotationMs(Math.max(3, state.rotation_seconds ?? 8) * 1000)
      teamIdRef.current = state.team_id
      sideRef.current = state.side
      await loadLineup()
    }

    loadState()

    const ch = supabase.channel('lineup-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lineup_overlay_state' },
        ({ new: row }) => loadState(row as LineupStateRow))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_starters' },
        () => loadLineup())
      // Mutual exclusion: hide when another big graphic goes live
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overlay_state' },
        ({ new: row }: any) => { if (row?.visible === true) setVisible(false) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_overlay_state' },
        ({ new: row }: any) => { if (row?.visible === true) setVisible(false) })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  const screens = buildLineupScreens(side, groupedIds, roster)

  useEffect(() => { setIdx(0); setShown(true) }, [screens.length, side, style])

  useEffect(() => {
    if (style !== 'band' || screens.length <= 1) return
    const interval = setInterval(() => {
      setShown(false)
      setTimeout(() => { setIdx(i => (i + 1) % screens.length); setShown(true) }, 400)
    }, rotationMs)
    return () => clearInterval(interval)
  }, [style, screens.length, rotationMs])

  return (
    <>
      <LineupBand team={team} side={side} screens={screens} idx={idx} shown={shown} visible={visible && style === 'band'} />
      <LineupFullPanel team={team} side={side} groupedIds={groupedIds} roster={roster} visible={visible && style === 'full'} />
    </>
  )
}
