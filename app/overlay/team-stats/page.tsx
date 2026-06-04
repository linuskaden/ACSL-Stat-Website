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
  tds: number; fgMade: number; ints: number; fumbles: number
  receptions: number; targets: number
}

// ── Stat calculation ──────────────────────────────────────────────────────────
function emptyStats(): TeamStats {
  return { passYds: 0, rushYds: 0, totalYds: 0, tds: 0, fgMade: 0, ints: 0, fumbles: 0, receptions: 0, targets: 0 }
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

    if (pos.includes('QB')) {
      s.passYds += q.pass_yards ?? 0
      s.rushYds += q.qb_rush_yards ?? 0
      // pass_tds counted from QB side only — avoids double-counting with rec_tds
      s.tds += (q.pass_tds ?? 0) + (q.qb_rush_tds ?? 0)
      s.ints += q.interceptions_thrown ?? 0
    } else if (pos.includes('RB')) {
      s.rushYds += q.rush_yards ?? 0
      s.tds += q.rush_tds ?? 0
      s.fumbles += q.rb_fumbles ?? 0
      s.targets += q.rb_targets ?? 0
      s.receptions += q.rb_receptions ?? 0
    } else if (pos.some(pp => ['WR', 'TE'].includes(pp))) {
      // rec_tds skipped (already counted via QB's pass_tds)
      s.fumbles += q.rec_fumbles ?? 0
      s.targets += q.rec_targets ?? 0
      s.receptions += q.receptions ?? 0
    } else if (pos.includes('K')) {
      s.fgMade += q.fg_made ?? 0
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
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  const homeStats = calcStats(homePlayers, gameStats)
  const awayStats = calcStats(awayPlayers, gameStats)

  // ── Layout constants (1920×1080 canvas) ────────────────────────────────────
  const W         = 1760
  const H         = 900
  const HEADER_H  = 112
  const LOGO_W    = 300
  const CENTER_W  = W - LOGO_W * 2
  const ROWS_H    = H - HEADER_H

  const homeColor  = homeTeam?.primary_color ?? '#1a1a2e'
  const awayColor  = awayTeam?.primary_color ?? '#2e1a1a'
  const homeText   = textOn(homeColor)
  const awayText   = textOn(awayColor)
  const homeDim    = homeText === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
  const awayDim    = awayText === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'

  const statusLabel = gameMeta?.status === 'live'  ? 'LIVE'
                    : gameMeta?.status === 'final' ? 'FINAL' : null

  type StatRow = { label: string; h: string | number; a: string | number; accent?: string }
  const STAT_ROWS: StatRow[] = [
    { label: 'PASS YDS',    h: homeStats.passYds,  a: awayStats.passYds  },
    { label: 'RUSH YDS',    h: homeStats.rushYds,  a: awayStats.rushYds  },
    { label: 'TOTAL YDS',   h: homeStats.totalYds, a: awayStats.totalYds },
    { label: 'REC / TAR',   h: `${homeStats.receptions}/${homeStats.targets}`, a: `${awayStats.receptions}/${awayStats.targets}` },
    { label: 'TOTAL TDs',   h: homeStats.tds,      a: awayStats.tds,      accent: '#04a550' },
    { label: 'FIELD GOALS', h: homeStats.fgMade,   a: awayStats.fgMade   },
    { label: 'INT',         h: homeStats.ints,     a: awayStats.ints,     accent: '#ff1d25' },
    { label: 'FUMBLES',     h: homeStats.fumbles,  a: awayStats.fumbles,  accent: '#f59e0b' },
  ]

  const N_ROWS = STAT_ROWS.length

  return (
    <div style={{
      position: 'absolute',
      top:  (1080 - H) / 2,
      left: (1920 - W) / 2,
      width: W, height: H,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 40px 120px rgba(0,0,0,0.95), 0 8px 40px rgba(0,0,0,0.8)',
      opacity: visible ? 1 : 0,
      transform: visible ? 'scale(1)' : 'scale(0.96)',
      transition: 'opacity 0.45s cubic-bezier(0.22,1,0.36,1), transform 0.45s cubic-bezier(0.22,1,0.36,1)',
      pointerEvents: 'none',
    }}>

      {/* ── Header: game score ─────────────────────────────────────────────── */}
      <div style={{
        height: HEADER_H, flexShrink: 0,
        background: '#06080f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
      }}>
        {/* Left accent line */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: homeColor }} />
        {/* Right accent line */}
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, background: awayColor }} />

        {/* Home side */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 18, paddingRight: 48 }}>
          {homeTeam?.logo_url && (
            <img src={homeTeam.logo_url} alt="" style={{ width: 52, height: 52, objectFit: 'contain', opacity: 0.9 }} />
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>
              HOME
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 1, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1.2, marginTop: 2 }}>
              {homeTeam?.short_name?.toUpperCase() ?? '—'}
            </div>
          </div>
          <div style={{
            fontSize: 62, fontWeight: 900, color: '#fff',
            fontFamily: '"Arial Black", Impact, sans-serif',
            letterSpacing: -2, lineHeight: 1,
            textShadow: `0 0 30px ${homeColor}80`,
          }}>
            {gameMeta?.home_score ?? 0}
          </div>
        </div>

        {/* Center: title + status */}
        <div style={{ width: 200, textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 4, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', fontFamily: '"Arial Black", sans-serif' }}>
            TEAM STATS
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'rgba(255,255,255,0.15)', fontFamily: '"Arial Black", sans-serif', lineHeight: 1, marginTop: 2 }}>
            —
          </div>
          {statusLabel && (
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: 3,
              color: gameMeta?.status === 'live' ? '#ff1d25' : '#04a550',
              textTransform: 'uppercase', fontFamily: '"Arial Black", sans-serif',
            }}>
              {statusLabel}
            </div>
          )}
        </div>

        {/* Away side */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 18, paddingLeft: 48 }}>
          <div style={{
            fontSize: 62, fontWeight: 900, color: '#fff',
            fontFamily: '"Arial Black", Impact, sans-serif',
            letterSpacing: -2, lineHeight: 1,
            textShadow: `0 0 30px ${awayColor}80`,
          }}>
            {gameMeta?.away_score ?? 0}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>
              AWAY
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 1, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1.2, marginTop: 2 }}>
              {awayTeam?.short_name?.toUpperCase() ?? '—'}
            </div>
          </div>
          {awayTeam?.logo_url && (
            <img src={awayTeam.logo_url} alt="" style={{ width: 52, height: 52, objectFit: 'contain', opacity: 0.9 }} />
          )}
        </div>
      </div>

      {/* ── Body: logo panels + stats ───────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Home logo panel */}
        <div style={{
          width: LOGO_W, flexShrink: 0,
          background: homeColor,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 20, position: 'relative', overflow: 'hidden',
        }}>
          {/* Inner radial highlight */}
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${lum(homeColor) > 0.3 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'} 0%, transparent 70%)` }} />
          {homeTeam?.logo_url ? (
            <img
              src={homeTeam.logo_url} alt=""
              style={{ width: 200, height: 200, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.45))' }}
            />
          ) : (
            <div style={{ fontSize: 56, fontWeight: 900, color: homeText, fontFamily: '"Arial Black", sans-serif', position: 'relative', zIndex: 1 }}>
              {homeTeam?.short_name ?? '—'}
            </div>
          )}
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 12px' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: homeText, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.5, lineHeight: 1, textTransform: 'uppercase' }}>
              {homeTeam?.short_name}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: homeDim, letterSpacing: 3, marginTop: 5, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>
              {homeTeam?.name}
            </div>
          </div>
        </div>

        {/* Center stats panel */}
        <div style={{ flex: 1, background: '#080b14', display: 'flex', flexDirection: 'column' }}>
          {STAT_ROWS.map(({ label, h, a, accent }, i) => {
            const hNum    = typeof h === 'number' ? h : null
            const aNum    = typeof a === 'number' ? a : null
            const hWins   = hNum !== null && aNum !== null && hNum > aNum
            const aWins   = hNum !== null && aNum !== null && aNum > hNum
            const isLast  = i === N_ROWS - 1
            const rowH    = ROWS_H / N_ROWS
            const hiColor = accent ?? '#ffffff'
            const dimVal  = 'rgba(255,255,255,0.55)'

            return (
              <div
                key={label}
                style={{
                  height: rowH, flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.038)',
                  padding: '0 12px',
                  position: 'relative',
                }}
              >
                {/* Leading-stat bar (left edge highlight for winner) */}
                {hWins && (
                  <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: hiColor, borderRadius: '0 2px 2px 0', opacity: 0.7 }} />
                )}
                {aWins && (
                  <div style={{ position: 'absolute', right: 0, top: '20%', bottom: '20%', width: 3, background: hiColor, borderRadius: '2px 0 0 2px', opacity: 0.7 }} />
                )}

                {/* Home value */}
                <div style={{ flex: 1, textAlign: 'right', paddingRight: 36 }}>
                  <span style={{
                    fontSize: hWins ? 40 : 34,
                    fontWeight: 900,
                    fontFamily: '"Arial Black", Impact, sans-serif',
                    color: hWins ? hiColor : dimVal,
                    letterSpacing: -0.5, lineHeight: 1,
                    textShadow: hWins && accent ? `0 0 24px ${accent}50` : 'none',
                    display: 'inline-block',
                    transition: 'font-size 0.25s ease',
                  }}>
                    {h}
                  </span>
                </div>

                {/* Label */}
                <div style={{ width: 150, textAlign: 'center', flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    letterSpacing: 2.5, color: 'rgba(255,255,255,0.28)',
                    textTransform: 'uppercase',
                    fontFamily: '"Arial Black", Arial, sans-serif',
                  }}>
                    {label}
                  </span>
                </div>

                {/* Away value */}
                <div style={{ flex: 1, textAlign: 'left', paddingLeft: 36 }}>
                  <span style={{
                    fontSize: aWins ? 40 : 34,
                    fontWeight: 900,
                    fontFamily: '"Arial Black", Impact, sans-serif',
                    color: aWins ? hiColor : dimVal,
                    letterSpacing: -0.5, lineHeight: 1,
                    textShadow: aWins && accent ? `0 0 24px ${accent}50` : 'none',
                    display: 'inline-block',
                    transition: 'font-size 0.25s ease',
                  }}>
                    {a}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Away logo panel */}
        <div style={{
          width: LOGO_W, flexShrink: 0,
          background: awayColor,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 20, position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${lum(awayColor) > 0.3 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'} 0%, transparent 70%)` }} />
          {awayTeam?.logo_url ? (
            <img
              src={awayTeam.logo_url} alt=""
              style={{ width: 200, height: 200, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.45))' }}
            />
          ) : (
            <div style={{ fontSize: 56, fontWeight: 900, color: awayText, fontFamily: '"Arial Black", sans-serif', position: 'relative', zIndex: 1 }}>
              {awayTeam?.short_name ?? '—'}
            </div>
          )}
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 12px' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: awayText, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.5, lineHeight: 1, textTransform: 'uppercase' }}>
              {awayTeam?.short_name}
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: awayDim, letterSpacing: 3, marginTop: 5, textTransform: 'uppercase', fontFamily: 'Arial, sans-serif' }}>
              {awayTeam?.name}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
