'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcYPC } from '@/lib/utils'

/* ─── Types ─── */
type KeyPlayerStateRow = {
  id: number
  game_id: string | null
  player_ids: string[]
  rotation_seconds: number
  visible: boolean
}
type StatItem = { label: string; value: string | number }
type KeyPlayer = {
  id: string
  first_name: string
  last_name: string
  jersey_number: string | null
  positions: string[]
  team: { short_name: string; name: string; primary_color: string } | null
  stats: StatItem[]
}

/* ─── Per-position ticker stats (QB / WR-TE / RB only) ─── */
function buildTickerStats(positions: string[], s: any): StatItem[] {
  if (!s) return []
  const primaryPos = positions[0] ?? ''
  if (primaryPos === 'QB') {
    return [
      { label: 'COMP/ATT', value: `${s.pass_completions ?? 0}/${s.pass_attempts ?? 0}` },
      { label: 'TOTAL YDS', value: (s.pass_yards ?? 0) + (s.qb_rush_yards ?? 0) },
    ]
  }
  if (['WR', 'TE'].includes(primaryPos)) {
    return [
      { label: 'REC/TAR', value: `${s.receptions ?? 0}/${s.rec_targets ?? 0}` },
      { label: 'REC YDS', value: s.rec_yards ?? 0 },
    ]
  }
  if (primaryPos === 'RB') {
    return [
      { label: 'CAR', value: s.rush_carries ?? 0 },
      { label: 'RUSH YDS', value: s.rush_yards ?? 0 },
      { label: 'YPC', value: calcYPC(s.rush_yards ?? 0, s.rush_carries ?? 0) },
    ]
  }
  return []
}

/* ════════════════════════════════════════════
   Key Player ticker — permanent, rotating, clean text, bottom-right
════════════════════════════════════════════ */
export default function KeyPlayersOverlay() {
  const [players, setPlayers] = useState<KeyPlayer[]>([])
  const [visible, setVisible] = useState(false)
  const [rotationMs, setRotationMs] = useState(6000)
  const [idx, setIdx] = useState(0)
  const [shown, setShown] = useState(true) // drives the crossfade

  // Keep the latest state in refs so realtime callbacks can re-fetch consistently
  const gameIdRef = useRef<string | null>(null)
  const playerIdsRef = useRef<string[]>([])

  useEffect(() => {
    const supabase = createClient()

    async function loadStats() {
      const ids = playerIdsRef.current
      const gameId = gameIdRef.current
      if (ids.length === 0) { setPlayers([]); return }

      const [{ data: ps }, { data: gs }] = await Promise.all([
        supabase.from('players').select('id, first_name, last_name, jersey_number, positions, team:teams(short_name, name, primary_color)').in('id', ids),
        gameId
          ? supabase.from('game_stats').select('*').eq('game_id', gameId).in('player_id', ids)
          : Promise.resolve({ data: [] as any[] }),
      ])

      // Aggregate game stats per player
      const totalsByPlayer: Record<string, Record<string, number>> = {}
      ;(gs ?? []).forEach((row: any) => {
        const acc = totalsByPlayer[row.player_id] ?? (totalsByPlayer[row.player_id] = {})
        Object.entries(row).forEach(([k, v]) => { if (typeof v === 'number') acc[k] = (acc[k] ?? 0) + v })
      })

      // Preserve the selection order from player_ids
      const built = ids
        .map(id => {
          const p = (ps ?? []).find((x: any) => x.id === id)
          if (!p) return null
          const team = Array.isArray((p as any).team) ? (p as any).team[0] ?? null : (p as any).team ?? null
          return {
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            jersey_number: p.jersey_number,
            positions: p.positions,
            team,
            stats: buildTickerStats(p.positions, totalsByPlayer[id] ?? {}),
          } as KeyPlayer
        })
        .filter(Boolean) as KeyPlayer[]

      setPlayers(built)
    }

    async function loadState(newState?: KeyPlayerStateRow) {
      let state = newState
      if (!state) {
        const { data } = await supabase.from('key_player_overlay_state').select('*').eq('id', 1).single()
        if (!data) return
        state = data as KeyPlayerStateRow
      }
      setVisible(state.visible)
      setRotationMs(Math.max(2, state.rotation_seconds ?? 6) * 1000)
      gameIdRef.current = state.game_id
      playerIdsRef.current = state.player_ids ?? []
      await loadStats()
    }

    loadState()

    const ch = supabase.channel('key-player-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'key_player_overlay_state' },
        ({ new: row }) => loadState(row as KeyPlayerStateRow))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats' },
        () => loadStats())
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  // Reset rotation whenever the roster changes
  useEffect(() => { setIdx(0); setShown(true) }, [players.length])

  // Rotate through players with a short crossfade
  useEffect(() => {
    if (players.length <= 1) return
    const interval = setInterval(() => {
      setShown(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % players.length)
        setShown(true)
      }, 380)
    }, rotationMs)
    return () => clearInterval(interval)
  }, [players.length, rotationMs])

  const current = players[idx] ?? null
  const active = visible && current

  return (
    <div style={{
      position: 'absolute',
      bottom: 90,
      right: 36,
      textAlign: 'right',
      transition: 'opacity 0.45s ease, transform 0.45s cubic-bezier(0.22,1,0.36,1)',
      opacity:   active ? 1 : 0,
      transform: active ? 'translateY(0)' : 'translateY(14px)',
      pointerEvents: 'none',
    }}>
      {current && (
        <div style={{
          transition: 'opacity 0.34s ease',
          opacity: shown ? 1 : 0,
        }}>
          {/* Name line */}
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 9, lineHeight: 1,
            textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.8)',
          }}>
            {current.jersey_number != null && (
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif' }}>
                #{current.jersey_number}
              </span>
            )}
            <span style={{ color: '#ffffff', fontSize: 26, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
              {current.first_name.charAt(0).toUpperCase()}. {current.last_name.toUpperCase()}
            </span>
          </div>

          {/* Team · position line */}
          <div style={{
            marginTop: 5, lineHeight: 1,
            color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase',
            textShadow: '0 2px 6px rgba(0,0,0,0.9)',
          }}>
            {current.team?.short_name ?? ''} · {current.positions[0] ?? ''}
          </div>

          {/* Stats line */}
          {current.stats.length > 0 && (
            <div style={{
              marginTop: 9, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 18,
              textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.8)',
            }}>
              {current.stats.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ color: '#ffffff', fontSize: 22, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1, letterSpacing: -0.5 }}>
                    {item.value}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
