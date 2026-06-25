'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcYPC, calcYPR } from '@/lib/utils'

/* ─── Types ─── */
type OverlayStateRow = {
  id: number
  active_player_id: string | null
  game_id: string | null
  mode: 'live' | 'career' | 'intro'
  visible: boolean
}
type StatItem = { label: string; value: string | number }

/* ─── Helpers ─── */
function lum(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}
function textOn(hex: string): string { return lum(hex) > 0.48 ? '#000000' : '#ffffff' }

function buildStats(positions: string[], s: any): StatItem[] {
  if (!s) return []
  const items: StatItem[] = []
  const primaryPos = positions[0] ?? ''
  const hasKP  = positions.some((p: string) => ['K', 'P'].includes(p))
  const hasDef = positions.some((p: string) => ['DB', 'LB', 'DL', 'OL'].includes(p))

  if (primaryPos === 'QB') {
    items.push(
      { label: 'PASS YDS', value: s.pass_yards ?? 0 },
      { label: 'TDs',      value: (s.pass_tds ?? 0) + (s.qb_rush_tds ?? 0) },
      { label: 'INT',      value: s.interceptions_thrown ?? 0 },
      { label: 'COMP/ATT', value: `${s.pass_completions ?? 0}/${s.pass_attempts ?? 0}` },
      { label: 'RUSH YDS', value: s.qb_rush_yards ?? 0 },
    )
  } else if (primaryPos === 'RB') {
    items.push(
      { label: 'RUSH YDS', value: s.rush_yards ?? 0 },
      { label: 'TDs',      value: s.rush_tds ?? 0 },
      { label: 'CAR',      value: s.rush_carries ?? 0 },
      { label: 'YPC',      value: calcYPC(s.rush_yards ?? 0, s.rush_carries ?? 0) },
      { label: 'REC YDS',  value: s.rb_rec_yards ?? 0 },
    )
  } else if (['WR', 'TE'].includes(primaryPos)) {
    items.push(
      { label: 'REC YDS', value: s.rec_yards ?? 0 },
      { label: 'TDs',     value: s.rec_tds ?? 0 },
      { label: 'REC',     value: s.receptions ?? 0 },
      { label: 'TARGETS', value: s.rec_targets ?? 0 },
      { label: 'YPR',     value: calcYPR(s.rec_yards ?? 0, s.receptions ?? 0) },
    )
  } else {
    if (hasDef || !hasKP) {
      items.push(
        { label: 'SACKS', value: s.sacks ?? 0 },
        { label: 'INT',   value: s.def_interceptions ?? 0 },
      )
    }
  }

  if (hasKP) {
    items.push(
      { label: 'FG',  value: `${s.fg_made ?? 0}/${s.fg_attempts ?? 0}` },
      { label: 'EP',  value: `${s.ep_made ?? 0}/${s.ep_attempts ?? 0}` },
      { label: 'PTS', value: (s.fg_made ?? 0) * 3 + (s.ep_made ?? 0) },
    )
  }

  return items
}

/* ════════════════════════════════════════════
   Player lower-third overlay
════════════════════════════════════════════ */
export default function LowerThirdOverlay() {
  const [player, setPlayer]               = useState<any>(null)
  const [playerStats, setPlayerStats]     = useState<any>(null)
  const [playerVisible, setPlayerVisible] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function loadPlayer(newState?: OverlayStateRow) {
      let state = newState
      if (!state) {
        const { data } = await supabase.from('overlay_state').select('*').eq('id', 1).single()
        if (!data) return
        state = data as OverlayStateRow
      }
      setPlayerVisible(state.visible)
      if (!state.active_player_id) { setPlayer(null); setPlayerStats(null); return }

      const { data: p } = await supabase
        .from('players').select('*, team:teams(*)').eq('id', state.active_player_id).single()
      setPlayer(p)

      if (state.mode === 'intro') {
        setPlayerStats(null)
      } else if (state.mode === 'live' && state.game_id) {
        const { data: gs } = await supabase
          .from('game_stats').select('*')
          .eq('game_id', state.game_id).eq('player_id', state.active_player_id)
        if (gs && gs.length > 0) {
          const totals: Record<string, number> = {}
          gs.forEach((row: any) => Object.entries(row).forEach(([k, v]) => {
            if (typeof v === 'number') totals[k] = (totals[k] ?? 0) + v
          }))
          setPlayerStats(totals)
        } else setPlayerStats({})
      } else if (state.mode === 'career') {
        const { data: cs } = await supabase
          .from('career_stats').select('*').eq('player_id', state.active_player_id)
          .order('season', { ascending: false }).limit(1).maybeSingle()
        setPlayerStats(cs ?? {})
      }
    }

    loadPlayer()

    const ch = supabase.channel('lower-third-player')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overlay_state' },
        ({ new: row }) => loadPlayer(row as OverlayStateRow))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats' },
        () => loadPlayer())
      // Mutual exclusion: if team stats become visible, hide this overlay
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_overlay_state' },
        ({ new: row }: any) => { if (row?.visible === true) setPlayerVisible(false) })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  /* ── Derived values ── */
  const team          = player?.team
  const pos: string[] = player?.positions ?? []
  const statItems     = buildStats(pos, playerStats)
  const hasStats      = statItems.length > 0

  const primaryColor = team?.primary_color ?? '#ff1d25'
  const onPrimary    = textOn(primaryColor)
  const dimOnPrimary = onPrimary === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.50)'
  const hairline     = onPrimary === '#ffffff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'

  return (
    <div style={{
      position: 'absolute',
      bottom: 56,
      left: 72,
      transition: 'transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease',
      transform: playerVisible ? 'translateY(0)' : 'translateY(160%)',
      opacity:   playerVisible ? 1 : 0,
      pointerEvents: 'none',
    }}>
      {player && (
        <div style={{ display: 'inline-flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.85), 0 4px 20px rgba(0,0,0,0.6)' }}>

          {/* Nameplate */}
          <div style={{ display: 'flex', alignItems: 'stretch', background: primaryColor, height: 80 }}>
            <div style={{ width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 10 }}>
              {team?.logo_url
                ? <img src={team.logo_url} alt="" style={{ width: 66, height: 66, objectFit: 'contain' }} />
                : <div style={{ width: 66, height: 66, borderRadius: 4, background: hairline }} />}
            </div>
            <div style={{ width: 1, background: hairline, margin: '12px 0', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 22px', gap: 5 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, lineHeight: 1 }}>
                {player.jersey_number != null && (
                  <span style={{ color: dimOnPrimary, fontSize: 18, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.5, flexShrink: 0 }}>
                    #{player.jersey_number}
                  </span>
                )}
                <span style={{ color: onPrimary, fontSize: 26, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                  {player.first_name.toUpperCase()} {player.last_name.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, lineHeight: 1 }}>
                <span style={{ color: onPrimary, fontSize: 11, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', background: hairline, padding: '3px 7px', borderRadius: 2 }}>
                  {pos.join(' · ')}
                </span>
                <span style={{ color: hairline, fontSize: 12 }}>·</span>
                <span style={{ color: dimOnPrimary, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
                  {team?.short_name ?? team?.name}
                </span>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          {hasStats && (
            <div style={{ background: '#0b0e1a', display: 'flex', alignItems: 'center', padding: '10px 22px 10px 102px', gap: 0, borderTop: `2px solid ${primaryColor}` }}>
              {statItems.map((item, i) => (
                <div key={item.label} style={{ textAlign: 'center', paddingRight: 20, paddingLeft: i === 0 ? 0 : 20, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                  <div style={{ color: '#ffffff', fontSize: 22, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1, letterSpacing: -0.5 }}>
                    {item.value}
                  </div>
                  <div style={{ color: '#7a7a9a', fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
