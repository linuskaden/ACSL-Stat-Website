'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcYPC, calcYPR } from '@/lib/utils'

type OverlayStateRow = {
  id: number
  active_player_id: string | null
  game_id: string | null
  mode: 'live' | 'career'
  visible: boolean
}

type StatItem = { label: string; value: string | number }

/** Auto-detect readable text color based on background luminance */
function textOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.48 ? '#000000' : '#ffffff'
}

function buildStats(positions: string[], s: any): StatItem[] {
  if (!s) return []
  if (positions.includes('QB')) return [
    { label: 'PASS YDS', value: s.pass_yards ?? 0 },
    { label: 'TDs',      value: (s.pass_tds ?? 0) + (s.qb_rush_tds ?? 0) },
    { label: 'INT',      value: s.interceptions_thrown ?? 0 },
    { label: 'COMP/ATT', value: `${s.pass_completions ?? 0}/${s.pass_attempts ?? 0}` },
    { label: 'RUSH YDS', value: s.qb_rush_yards ?? 0 },
  ]
  if (positions.includes('RB')) return [
    { label: 'RUSH YDS', value: s.rush_yards ?? 0 },
    { label: 'TDs',      value: s.rush_tds ?? 0 },
    { label: 'CAR',      value: s.rush_carries ?? 0 },
    { label: 'YPC',      value: calcYPC(s.rush_yards ?? 0, s.rush_carries ?? 0) },
    { label: 'REC YDS',  value: s.rb_rec_yards ?? 0 },
  ]
  if (positions.some((p: string) => ['WR', 'TE'].includes(p))) return [
    { label: 'REC YDS', value: s.rec_yards ?? 0 },
    { label: 'TDs',     value: s.rec_tds ?? 0 },
    { label: 'REC',     value: s.receptions ?? 0 },
    { label: 'TARGETS', value: s.rec_targets ?? 0 },
    { label: 'YPR',     value: calcYPR(s.rec_yards ?? 0, s.receptions ?? 0) },
  ]
  if (positions.some((p: string) => ['K', 'P'].includes(p))) return [
    { label: 'FG',  value: `${s.fg_made ?? 0}/${s.fg_attempts ?? 0}` },
    { label: 'EP',  value: `${s.ep_made ?? 0}/${s.ep_attempts ?? 0}` },
    { label: 'PTS', value: (s.fg_made ?? 0) * 3 + (s.ep_made ?? 0) },
  ]
  return [
    { label: 'SACKS', value: s.sacks ?? 0 },
    { label: 'INT',   value: s.def_interceptions ?? 0 },
  ]
}

export default function LowerThirdOverlay() {
  const [player, setPlayer]           = useState<any>(null)
  const [stats, setStats]             = useState<any>(null)
  const [overlayState, setOverlayState] = useState<OverlayStateRow | null>(null)
  const [visible, setVisible]         = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function loadAll(newState?: OverlayStateRow) {
      let state = newState
      if (!state) {
        const { data } = await supabase
          .from('overlay_state').select('*').eq('id', 1).single()
        if (!data) return
        state = data as OverlayStateRow
      }

      setOverlayState(state)
      setVisible(state.visible)

      if (!state.active_player_id) { setPlayer(null); setStats(null); return }

      const { data: p } = await supabase
        .from('players').select('*, team:teams(*)').eq('id', state.active_player_id).single()
      setPlayer(p)

      if (state.mode === 'live' && state.game_id) {
        const { data: gs } = await supabase
          .from('game_stats').select('*')
          .eq('game_id', state.game_id).eq('player_id', state.active_player_id)
        if (gs && gs.length > 0) {
          const totals: Record<string, number> = {}
          gs.forEach((row: any) =>
            Object.entries(row).forEach(([k, v]) => {
              if (typeof v === 'number') totals[k] = (totals[k] ?? 0) + v
            })
          )
          setStats(totals)
        } else {
          setStats({})
        }
      } else if (state.mode === 'career') {
        const { data: cs } = await supabase
          .from('career_stats').select('*')
          .eq('player_id', state.active_player_id)
          .order('season', { ascending: false }).limit(1).maybeSingle()
        setStats(cs ?? {})
      }
    }

    loadAll()

    const channel = supabase.channel('lower-third-ctrl')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overlay_state' },
        ({ new: row }) => loadAll(row as OverlayStateRow))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats' },
        () => loadAll())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const team        = player?.team
  const pos: string[] = player?.positions ?? []
  const statItems   = buildStats(pos, stats)
  const hasStats    = statItems.length > 0
  const modeLabel   = overlayState?.mode === 'career' ? '2026 SEASON' : 'GAME STATS'

  const primaryColor  = team?.primary_color  ?? '#ff1d25'
  const secondaryColor = team?.secondary_color ?? '#ffffff'
  const onPrimary     = textOn(primaryColor)           // black or white depending on bg
  const dimOnPrimary  = onPrimary === '#ffffff'
    ? 'rgba(255,255,255,0.55)'
    : 'rgba(0,0,0,0.50)'
  const hairline      = onPrimary === '#ffffff'
    ? 'rgba(255,255,255,0.18)'
    : 'rgba(0,0,0,0.15)'

  /* ─── Slide-in / slide-out animation ─── */
  return (
    <div style={{
      position: 'absolute',
      bottom: 56,
      left: 72,
      transition: 'transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease',
      transform: visible ? 'translateY(0)' : 'translateY(160%)',
      opacity:   visible ? 1 : 0,
      pointerEvents: 'none',
    }}>
      {player && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.85), 0 4px 20px rgba(0,0,0,0.6)',
          minWidth: 560,
        }}>

          {/* ══ NAMEPLATE ══ */}
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
            background: primaryColor,
            height: 80,
          }}>
            {/* Logo block */}
            <div style={{
              width: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              padding: 10,
            }}>
              {team?.logo_url ? (
                <img
                  src={team.logo_url}
                  alt=""
                  style={{ width: 54, height: 54, objectFit: 'contain' }}
                />
              ) : (
                <div style={{ width: 54, height: 54, borderRadius: 4, background: hairline }} />
              )}
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: hairline, margin: '12px 0', flexShrink: 0 }} />

            {/* Info */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0 22px',
              gap: 5,
              flex: 1,
            }}>
              {/* Row 1: #Number  Name */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, lineHeight: 1 }}>
                {player.jersey_number != null && (
                  <span style={{
                    color: dimOnPrimary,
                    fontSize: 18,
                    fontWeight: 900,
                    fontFamily: '"Arial Black", Impact, sans-serif',
                    letterSpacing: 0.5,
                    flexShrink: 0,
                  }}>
                    #{player.jersey_number}
                  </span>
                )}
                <span style={{
                  color: onPrimary,
                  fontSize: 26,
                  fontWeight: 900,
                  fontFamily: '"Arial Black", Impact, sans-serif',
                  letterSpacing: 0.4,
                  whiteSpace: 'nowrap',
                }}>
                  {player.first_name.toUpperCase()} {player.last_name.toUpperCase()}
                </span>
              </div>

              {/* Row 2: Position  ·  Team */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, lineHeight: 1 }}>
                <span style={{
                  color: onPrimary,
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  background: hairline,
                  padding: '3px 7px',
                  borderRadius: 2,
                }}>
                  {pos.join(' · ')}
                </span>
                <span style={{ color: hairline, fontSize: 12 }}>·</span>
                <span style={{
                  color: dimOnPrimary,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}>
                  {team?.short_name ?? team?.name}
                </span>
              </div>
            </div>

            {/* Secondary color accent bar on right edge */}
            <div style={{ width: 5, background: secondaryColor, flexShrink: 0 }} />
          </div>

          {/* ══ STATS BAR (only when stats exist) ══ */}
          {hasStats && (
            <div style={{
              background: '#0b0e1a',
              display: 'flex',
              alignItems: 'center',
              padding: '10px 22px 10px 102px', /* 80 (logo) + 1 (divider) + 22 (padding) = align with name */
              gap: 0,
              borderTop: `2px solid ${primaryColor}`,
            }}>
              {statItems.map((item, i) => (
                <div key={item.label} style={{
                  textAlign: 'center',
                  paddingRight: 20,
                  paddingLeft: i === 0 ? 0 : 20,
                  borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}>
                  <div style={{
                    color: '#ffffff',
                    fontSize: 22,
                    fontWeight: 900,
                    fontFamily: '"Arial Black", Impact, sans-serif',
                    lineHeight: 1,
                    letterSpacing: -0.5,
                  }}>
                    {item.value}
                  </div>
                  <div style={{
                    color: '#3a3a5a',
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    marginTop: 3,
                  }}>
                    {item.label}
                  </div>
                </div>
              ))}
              <div style={{
                marginLeft: 'auto',
                color: '#2a2a3a',
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}>
                {modeLabel}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
