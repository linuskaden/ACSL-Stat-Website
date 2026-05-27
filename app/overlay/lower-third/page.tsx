'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcYPA, calcYPC, calcYPR } from '@/lib/utils'

type OverlayStateRow = {
  id: number
  active_player_id: string | null
  game_id: string | null
  mode: 'live' | 'career'
  visible: boolean
}

type StatItem = { label: string; value: string | number }

function buildStats(positions: string[], s: any, mode: string): StatItem[] {
  if (!s) return []
  const pos = positions as string[]

  if (pos.includes('QB')) return [
    { label: 'PASS YDS', value: s.pass_yards ?? 0 },
    { label: 'TDs', value: (s.pass_tds ?? 0) + (s.qb_rush_tds ?? 0) },
    { label: 'INT', value: s.interceptions_thrown ?? 0 },
    { label: 'COMP/ATT', value: `${s.pass_completions ?? 0}/${s.pass_attempts ?? 0}` },
    { label: 'RUSH YDS', value: s.qb_rush_yards ?? 0 },
  ]
  if (pos.includes('RB')) return [
    { label: 'RUSH YDS', value: s.rush_yards ?? 0 },
    { label: 'TDs', value: s.rush_tds ?? 0 },
    { label: 'CARRIES', value: s.rush_carries ?? 0 },
    { label: 'YPC', value: calcYPC(s.rush_yards ?? 0, s.rush_carries ?? 0) },
    { label: 'REC YDS', value: s.rb_rec_yards ?? 0 },
  ]
  if (pos.some((p: string) => ['WR', 'TE'].includes(p))) return [
    { label: 'REC YDS', value: s.rec_yards ?? 0 },
    { label: 'TDs', value: s.rec_tds ?? 0 },
    { label: 'REC', value: s.receptions ?? 0 },
    { label: 'TARGETS', value: s.rec_targets ?? 0 },
    { label: 'YPR', value: calcYPR(s.rec_yards ?? 0, s.receptions ?? 0) },
  ]
  if (pos.some((p: string) => ['K', 'P'].includes(p))) return [
    { label: 'FG', value: `${s.fg_made ?? 0}/${s.fg_attempts ?? 0}` },
    { label: 'EP', value: `${s.ep_made ?? 0}/${s.ep_attempts ?? 0}` },
    { label: 'PTS', value: (s.fg_made ?? 0) * 3 + (s.ep_made ?? 0) },
  ]
  // Defensive fallback
  return [
    { label: 'SACKS', value: s.sacks ?? 0 },
    { label: 'INT', value: s.def_interceptions ?? 0 },
  ]
}

export default function LowerThirdOverlay() {
  const [player, setPlayer] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [overlayState, setOverlayState] = useState<OverlayStateRow | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function loadAll(newState?: OverlayStateRow) {
      let state = newState
      if (!state) {
        const { data } = await supabase
          .from('overlay_state')
          .select('*')
          .eq('id', 1)
          .single()
        if (!data) return
        state = data as OverlayStateRow
      }

      setOverlayState(state)
      setVisible(state.visible)

      if (!state.active_player_id) {
        setPlayer(null)
        setStats(null)
        return
      }

      // Load player + team in parallel with stats
      const [{ data: p }] = await Promise.all([
        supabase.from('players').select('*, team:teams(*)').eq('id', state.active_player_id).single(),
      ])
      setPlayer(p)

      if (state.mode === 'live' && state.game_id) {
        const { data: gs } = await supabase
          .from('game_stats')
          .select('*')
          .eq('game_id', state.game_id)
          .eq('player_id', state.active_player_id)

        if (gs && gs.length > 0) {
          const totals: Record<string, number> = {}
          gs.forEach((row: any) => {
            Object.entries(row).forEach(([k, v]) => {
              if (typeof v === 'number') totals[k] = (totals[k] ?? 0) + v
            })
          })
          setStats(totals)
        } else {
          setStats({})
        }
      } else if (state.mode === 'career') {
        const { data: cs } = await supabase
          .from('career_stats')
          .select('*')
          .eq('player_id', state.active_player_id)
          .order('season', { ascending: false })
          .limit(1)
          .maybeSingle()
        setStats(cs ?? {})
      }
    }

    loadAll()

    const channel = supabase
      .channel('lower-third-ctrl')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'overlay_state' },
        ({ new: row }) => loadAll(row as OverlayStateRow),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_stats' },
        () => loadAll(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const team = player?.team
  const pos: string[] = player?.positions ?? []
  const statItems = buildStats(pos, stats, overlayState?.mode ?? 'live')
  const modeLabel = overlayState?.mode === 'career' ? '2026 SEASON' : 'GAME STATS'
  const primaryColor = team?.primary_color ?? '#ff1d25'
  const secondaryColor = team?.secondary_color ?? 'rgba(255,255,255,0.15)'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        left: 80,
        transition: 'transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.35s ease',
        transform: visible ? 'translateY(0)' : 'translateY(150%)',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
      }}
    >
      {player && (
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            overflow: 'hidden',
            boxShadow: '0 16px 56px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.5)',
            height: 108,
            minWidth: 760,
          }}
        >
          {/* ── Left: Team color block with logo + jersey ── */}
          <div
            style={{
              background: primaryColor,
              width: 110,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              flexShrink: 0,
              position: 'relative',
            }}
          >
            {/* subtle inner shadow on right edge */}
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: 20,
              background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.25))',
            }} />
            {team?.logo_url ? (
              <img
                src={team.logo_url}
                alt=""
                style={{
                  width: 48,
                  height: 48,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
                }}
              />
            ) : (
              <div style={{
                width: 48, height: 48,
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 4,
              }} />
            )}
            {player.jersey_number != null && (
              <span
                style={{
                  color: 'white',
                  fontSize: 16,
                  fontWeight: 900,
                  fontFamily: '"Arial Black", Impact, sans-serif',
                  lineHeight: 1,
                  textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                  letterSpacing: 0.5,
                }}
              >
                #{player.jersey_number}
              </span>
            )}
          </div>

          {/* ── Accent line: secondary color ── */}
          <div style={{ width: 4, background: secondaryColor, flexShrink: 0 }} />

          {/* ── Right: Dark info section ── */}
          <div
            style={{
              background: '#0d1117',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0 24px',
              gap: 8,
            }}
          >
            {/* Name + position row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, lineHeight: 1 }}>
              <span
                style={{
                  color: 'white',
                  fontSize: 23,
                  fontWeight: 900,
                  fontFamily: '"Arial Black", Impact, sans-serif',
                  letterSpacing: 0.3,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {player.first_name.toUpperCase()} {player.last_name.toUpperCase()}
              </span>
              <span
                style={{
                  color: primaryColor,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {pos.join(' · ')}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  color: '#3a3a3a',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}
              >
                {modeLabel}
              </span>
            </div>

            {/* Stats row */}
            {statItems.length > 0 ? (
              <div style={{ display: 'flex', gap: 0, alignItems: 'flex-end' }}>
                {statItems.map((item, i) => (
                  <div
                    key={item.label}
                    style={{
                      textAlign: 'center',
                      paddingRight: 20,
                      paddingLeft: i === 0 ? 0 : 20,
                      borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        color: 'white',
                        fontSize: 26,
                        fontWeight: 900,
                        fontFamily: '"Arial Black", Impact, sans-serif',
                        lineHeight: 1,
                        letterSpacing: -0.5,
                      }}
                    >
                      {item.value}
                    </div>
                    <div
                      style={{
                        color: '#4a4a4a',
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: 1.5,
                        textTransform: 'uppercase',
                        marginTop: 3,
                      }}
                    >
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#2a2a2a', fontSize: 11, letterSpacing: 1 }}>
                NO STATS RECORDED
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
