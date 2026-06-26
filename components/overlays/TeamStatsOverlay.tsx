'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────
type Team = {
  id: string; name: string; short_name: string
  primary_color: string; secondary_color: string; logo_url: string | null
}
type GameMeta = {
  id: string; status: string
  home_score: number | null; away_score: number | null
}
type TeamOverlayState = {
  game_id: string | null
  display_team: 'both' | 'home' | 'away'
  visible: boolean
}
type TeamStats = {
  passYds: number; rushYds: number; totalYds: number
  tds: number; fgMade: number; epMade: number; ints: number; fumbles: number
  completions: number; attempts: number
}

// ── Stat calculation ──────────────────────────────────────────────────────────
function emptyStats(): TeamStats {
  return { passYds: 0, rushYds: 0, totalYds: 0, tds: 0, fgMade: 0, epMade: 0, ints: 0, fumbles: 0, completions: 0, attempts: 0 }
}

function calcStats(players: any[], rows: any[]): TeamStats {
  const s = emptyStats()
  for (const p of players) {
    const pRows = rows.filter(r => r.player_id === p.id)
    const q: Record<string, number> = {}
    for (const r of pRows) {
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === 'number') q[k] = (q[k] ?? 0) + v
      }
    }
    const pos: string[] = p.positions ?? []
    const primaryPos = pos[0] ?? ''

    if (primaryPos === 'QB') {
      s.passYds     += q.pass_yards ?? 0
      s.rushYds     += q.qb_rush_yards ?? 0
      s.completions += q.pass_completions ?? 0
      s.attempts    += q.pass_attempts ?? 0
      // pass_tds counted from QB side only — avoids double-counting with rec_tds
      s.tds += (q.pass_tds ?? 0) + (q.qb_rush_tds ?? 0)
      s.ints += q.interceptions_thrown ?? 0
    } else if (primaryPos === 'RB') {
      s.rushYds += q.rush_yards ?? 0
      s.tds     += q.rush_tds ?? 0
      s.fumbles += q.rb_fumbles ?? 0
    } else if (['WR', 'TE'].includes(primaryPos)) {
      // rec_tds skipped (already counted via QB's pass_tds)
      s.fumbles += q.rec_fumbles ?? 0
    } else if (pos.some(pp => ['K', 'P'].includes(pp))) {
      s.fgMade += q.fg_made ?? 0
      s.epMade += q.ep_made ?? 0
    }
  }
  s.totalYds = s.passYds + s.rushYds
  return s
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function lum(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}
function textOn(hex: string): string { return lum(hex) > 0.48 ? '#000000' : '#ffffff' }

// ── Overlay component ─────────────────────────────────────────────────────────
export default function TeamStatsOverlay() {
  const [state,        setState]       = useState<TeamOverlayState | null>(null)
  const [homeTeam,     setHomeTeam]    = useState<Team | null>(null)
  const [awayTeam,     setAwayTeam]    = useState<Team | null>(null)
  const [gameMeta,     setGameMeta]    = useState<GameMeta | null>(null)
  const [homePlayers,  setHomePlayers] = useState<any[]>([])
  const [awayPlayers,  setAwayPlayers] = useState<any[]>([])
  const [gameStats,    setGameStats]   = useState<any[]>([])
  const [visible,      setVisible]     = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function loadAll(newState?: TeamOverlayState) {
      let s = newState
      if (!s) {
        const { data } = await supabase.from('team_overlay_state').select('*').eq('id', 1).single()
        if (!data) return
        s = data as TeamOverlayState
      }
      setState(s)
      setVisible(s.visible)
      if (!s.game_id) return

      const { data: gd } = await supabase
        .from('games')
        .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
        .eq('id', s.game_id).single()
      if (!gd) return

      setGameMeta({ id: gd.id, status: gd.status, home_score: gd.home_score, away_score: gd.away_score })
      setHomeTeam((gd as any).home_team ?? null)
      setAwayTeam((gd as any).away_team ?? null)

      const teamIds = [(gd as any).home_team?.id, (gd as any).away_team?.id].filter(Boolean)
      const [{ data: players }, { data: gs }] = await Promise.all([
        supabase.from('players').select('*').in('team_id', teamIds),
        supabase.from('game_stats').select('*').eq('game_id', s.game_id),
      ])
      setHomePlayers((players ?? []).filter((p: any) => p.team_id === (gd as any).home_team?.id))
      setAwayPlayers((players ?? []).filter((p: any) => p.team_id === (gd as any).away_team?.id))
      setGameStats(gs ?? [])
    }

    loadAll()

    const ch = supabase.channel('team-stats-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_overlay_state' },
        ({ new: row }) => loadAll(row as TeamOverlayState))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats' },
        () => loadAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' },
        () => loadAll())
      // Mutual exclusion: if player overlay becomes visible, hide this overlay
      .on('postgres_changes', { event: '*', schema: 'public', table: 'overlay_state' },
        ({ new: row }: any) => { if (row?.visible === true) setVisible(false) })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  const homeStats = calcStats(homePlayers, gameStats)
  const awayStats = calcStats(awayPlayers, gameStats)

  // ── Layout constants (1920×1080 canvas) ──────────────────────────────────
  const TW        = 1760
  const TH        = 980
  const HEADER_H  = 130
  const LOGO_W    = 310
  const N_ROWS    = 8

  const hC = homeTeam?.primary_color ?? '#1a1a2e'
  const aC = awayTeam?.primary_color ?? '#2e1a1a'
  const hT = textOn(hC)
  const aT = textOn(aC)
  const homeDim = hT === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
  const awayDim = aT === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'

  const statusLabel = gameMeta?.status === 'live'  ? 'LIVE'
                    : gameMeta?.status === 'final' ? 'FINAL' : null

  type StatRow = { label: string; h: string | number; a: string | number; accent?: string }
  const STAT_ROWS: StatRow[] = [
    { label: 'PASS YDS',    h: homeStats.passYds,  a: awayStats.passYds  },
    { label: 'RUSH YDS',    h: homeStats.rushYds,  a: awayStats.rushYds  },
    { label: 'TOTAL YDS',   h: homeStats.totalYds, a: awayStats.totalYds },
    { label: 'COMP / ATT',  h: `${homeStats.completions}/${homeStats.attempts}`, a: `${awayStats.completions}/${awayStats.attempts}` },
    { label: 'TOTAL TDs',   h: homeStats.tds,      a: awayStats.tds,      accent: '#04a550' },
    { label: 'FIELD GOALS', h: homeStats.fgMade,   a: awayStats.fgMade   },
    { label: 'INT',         h: homeStats.ints,     a: awayStats.ints,     accent: '#ff1d25' },
    { label: 'FUMBLES',     h: homeStats.fumbles,  a: awayStats.fumbles,  accent: '#f59e0b' },
  ]

  return (
    <div style={{
      position: 'absolute',
      top:  100,
      left: (1920 - TW) / 2,
      width: TW, height: TH,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 40px 120px rgba(0,0,0,0.95), 0 8px 40px rgba(0,0,0,0.8)',
      opacity: visible ? 1 : 0,
      transform: visible ? 'scale(0.7)' : 'scale(0.67)',
      transformOrigin: 'top center',
      transition: 'opacity 0.45s cubic-bezier(0.22,1,0.36,1), transform 0.45s cubic-bezier(0.22,1,0.36,1)',
      pointerEvents: 'none',
    }}>

      {/* ── Header: game score ─────────────────────────────────────────────── */}
      <div style={{
        height: HEADER_H, flexShrink: 0,
        background: '#06080f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Home side */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 20, paddingRight: 52 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', fontFamily: 'Arial', lineHeight: 1 }}>HOME</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1.15, marginTop: 3 }}>{homeTeam?.short_name?.toUpperCase() ?? '—'}</div>
          </div>
          <div style={{ fontSize: 80, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: -3, lineHeight: 1, textShadow: `0 0 40px ${hC}90` }}>
            {homeStats.tds * 6 + homeStats.fgMade * 3 + homeStats.epMade}
          </div>
        </div>

        {/* Center: big TEAM STATS title */}
        <div style={{ width: 260, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 52, fontWeight: 900, letterSpacing: 2, color: 'rgba(255,255,255,0.12)', fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1, textTransform: 'uppercase' }}>TEAM</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 6, color: 'rgba(255,255,255,0.22)', fontFamily: '"Arial Black", sans-serif', lineHeight: 1, textTransform: 'uppercase', marginTop: -4 }}>STATS</div>
          {statusLabel && (
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color: gameMeta?.status === 'live' ? '#ff1d25' : '#04a550', textTransform: 'uppercase', fontFamily: '"Arial Black", sans-serif', marginTop: 4 }}>
              {statusLabel}
            </div>
          )}
        </div>

        {/* Away side */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 20, paddingLeft: 52 }}>
          <div style={{ fontSize: 80, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: -3, lineHeight: 1, textShadow: `0 0 40px ${aC}90` }}>
            {awayStats.tds * 6 + awayStats.fgMade * 3 + awayStats.epMade}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', fontFamily: 'Arial', lineHeight: 1 }}>AWAY</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1.15, marginTop: 3 }}>{awayTeam?.short_name?.toUpperCase() ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* ── Body: logo panels + stats ───────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Home logo panel */}
        <div style={{
          width: LOGO_W, flexShrink: 0,
          background: hC,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 22, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${lum(hC) > 0.3 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'} 0%, transparent 70%)` }} />
          {homeTeam?.logo_url ? (
            <img src={homeTeam.logo_url} alt="" style={{ width: 230, height: 230, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 8px 28px rgba(0,0,0,0.5))' }} />
          ) : (
            <div style={{ fontSize: 68, fontWeight: 900, color: hT, fontFamily: '"Arial Black", sans-serif', position: 'relative', zIndex: 1 }}>{homeTeam?.short_name ?? '—'}</div>
          )}
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 14px' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: hT, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 1, lineHeight: 1, textTransform: 'uppercase' }}>{homeTeam?.short_name}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: homeDim, letterSpacing: 3, marginTop: 6, textTransform: 'uppercase', fontFamily: 'Arial' }}>{homeTeam?.name}</div>
          </div>
        </div>

        {/* Center stats panel */}
        <div style={{ flex: 1, background: '#080b14', display: 'flex', flexDirection: 'column' }}>
          {STAT_ROWS.map(({ label, h, a, accent }, i) => {
            const hNum    = typeof h === 'number' ? h : null
            const aNum    = typeof a === 'number' ? a : null
            const hWins   = hNum !== null && aNum !== null && hNum > aNum
            const aWins   = hNum !== null && aNum !== null && aNum > hNum
            const rowH    = (TH - HEADER_H) / N_ROWS
            const hiColor = accent ?? '#ffffff'

            return (
              <div
                key={label}
                style={{
                  height: rowH, flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent',
                  borderBottom: i < N_ROWS - 1 ? '1px solid rgba(255,255,255,0.038)' : 'none',
                  padding: '0 12px',
                  position: 'relative',
                }}
              >
<div style={{ flex: 1, textAlign: 'right', paddingRight: 40 }}>
                  <span style={{
                    fontSize: hWins ? 52 : 44,
                    fontWeight: 900,
                    fontFamily: '"Arial Black", Impact, sans-serif',
                    color: hWins ? hiColor : 'rgba(255,255,255,0.55)',
                    letterSpacing: -1, lineHeight: 1,
                    textShadow: hWins && accent ? `0 0 28px ${accent}60` : 'none',
                  }}>{h}</span>
                </div>

                <div style={{ width: 170, textAlign: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', fontFamily: '"Arial Black", Arial, sans-serif' }}>{label}</span>
                </div>

                <div style={{ flex: 1, textAlign: 'left', paddingLeft: 40 }}>
                  <span style={{
                    fontSize: aWins ? 52 : 44,
                    fontWeight: 900,
                    fontFamily: '"Arial Black", Impact, sans-serif',
                    color: aWins ? hiColor : 'rgba(255,255,255,0.55)',
                    letterSpacing: -1, lineHeight: 1,
                    textShadow: aWins && accent ? `0 0 28px ${accent}60` : 'none',
                  }}>{a}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Away logo panel */}
        <div style={{
          width: LOGO_W, flexShrink: 0,
          background: aC,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 22, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${lum(aC) > 0.3 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'} 0%, transparent 70%)` }} />
          {awayTeam?.logo_url ? (
            <img src={awayTeam.logo_url} alt="" style={{ width: 230, height: 230, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 8px 28px rgba(0,0,0,0.5))' }} />
          ) : (
            <div style={{ fontSize: 68, fontWeight: 900, color: aT, fontFamily: '"Arial Black", sans-serif', position: 'relative', zIndex: 1 }}>{awayTeam?.short_name ?? '—'}</div>
          )}
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 14px' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: aT, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 1, lineHeight: 1, textTransform: 'uppercase' }}>{awayTeam?.short_name}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: awayDim, letterSpacing: 3, marginTop: 6, textTransform: 'uppercase', fontFamily: 'Arial' }}>{awayTeam?.name}</div>
          </div>
        </div>

      </div>
    </div>
  )
}
