'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcYPC, calcYPR } from '@/lib/utils'

/* ─── Types ─── */
type OverlayStateRow = {
  id: number
  active_player_id: string | null
  game_id: string | null
  mode: 'live' | 'career'
  visible: boolean
}
type TeamOverlayStateRow = {
  game_id: string | null
  display_team: 'both' | 'home' | 'away'
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
  const hasKP  = positions.some((p: string) => ['K', 'P'].includes(p))
  const hasDef = positions.some((p: string) => ['DB', 'LB', 'DL', 'OL'].includes(p))

  if (positions.includes('QB')) {
    items.push(
      { label: 'PASS YDS', value: s.pass_yards ?? 0 },
      { label: 'TDs',      value: (s.pass_tds ?? 0) + (s.qb_rush_tds ?? 0) },
      { label: 'INT',      value: s.interceptions_thrown ?? 0 },
      { label: 'COMP/ATT', value: `${s.pass_completions ?? 0}/${s.pass_attempts ?? 0}` },
      { label: 'RUSH YDS', value: s.qb_rush_yards ?? 0 },
    )
  } else if (positions.includes('RB')) {
    items.push(
      { label: 'RUSH YDS', value: s.rush_yards ?? 0 },
      { label: 'TDs',      value: s.rush_tds ?? 0 },
      { label: 'CAR',      value: s.rush_carries ?? 0 },
      { label: 'YPC',      value: calcYPC(s.rush_yards ?? 0, s.rush_carries ?? 0) },
      { label: 'REC YDS',  value: s.rb_rec_yards ?? 0 },
    )
  } else if (positions.some((p: string) => ['WR', 'TE'].includes(p))) {
    items.push(
      { label: 'REC YDS', value: s.rec_yards ?? 0 },
      { label: 'TDs',     value: s.rec_tds ?? 0 },
      { label: 'REC',     value: s.receptions ?? 0 },
      { label: 'TARGETS', value: s.rec_targets ?? 0 },
      { label: 'YPR',     value: calcYPR(s.rec_yards ?? 0, s.receptions ?? 0) },
    )
  } else {
    // DEF-Fallback — nur anzeigen wenn der Spieler tatsächlich eine DEF-Position hat
    // oder kein K/P ist (damit reine Kicker keine leeren Sacks/INT-Felder bekommen)
    if (hasDef || !hasKP) {
      items.push(
        { label: 'SACKS', value: s.sacks ?? 0 },
        { label: 'INT',   value: s.def_interceptions ?? 0 },
      )
    }
  }

  // Kicker-Stats immer anhängen wenn K oder P in den Positionen steht
  if (hasKP) {
    items.push(
      { label: 'FG',  value: `${s.fg_made ?? 0}/${s.fg_attempts ?? 0}` },
      { label: 'EP',  value: `${s.ep_made ?? 0}/${s.ep_attempts ?? 0}` },
      { label: 'PTS', value: (s.fg_made ?? 0) * 3 + (s.ep_made ?? 0) },
    )
  }

  return items
}

type TeamStats = {
  passYds: number; rushYds: number; recYds: number; totalYds: number
  tds: number; ints: number; fumbles: number; targets: number; receptions: number
  fgm: number; fga: number; epm: number; epa: number
}
function emptyTeamStats(): TeamStats {
  return { passYds: 0, rushYds: 0, recYds: 0, totalYds: 0, tds: 0, ints: 0, fumbles: 0, targets: 0, receptions: 0, fgm: 0, fga: 0, epm: 0, epa: 0 }
}
function calcTeamStats(players: any[], gsRows: any[]): TeamStats {
  const s = emptyTeamStats()
  players.forEach(p => {
    const rows = gsRows.filter(r => r.player_id === p.id)
    const qs: Record<string, number> = {}
    rows.forEach(r => Object.entries(r).forEach(([k, v]) => { if (typeof v === 'number') qs[k] = (qs[k] ?? 0) + v }))
    const pos: string[] = p.positions ?? []
    if (pos.includes('QB')) {
      s.passYds += qs.pass_yards ?? 0
      s.rushYds += qs.qb_rush_yards ?? 0
      s.tds     += (qs.pass_tds ?? 0) + (qs.qb_rush_tds ?? 0)
      s.ints    += qs.interceptions_thrown ?? 0
    } else if (pos.includes('RB')) {
      s.rushYds    += qs.rush_yards ?? 0
      s.recYds     += qs.rb_rec_yards ?? 0
      s.tds        += qs.rush_tds ?? 0
      s.fumbles    += qs.rb_fumbles ?? 0
      s.targets    += qs.rb_targets ?? 0
      s.receptions += qs.rb_receptions ?? 0
    } else if (pos.some(pp => ['WR', 'TE'].includes(pp))) {
      s.recYds     += qs.rec_yards ?? 0
      s.fumbles    += qs.rec_fumbles ?? 0
      s.targets    += qs.rec_targets ?? 0
      s.receptions += qs.receptions ?? 0
    }
    // K/P separat — zählt auch für Dual-Position-Spieler
    if (pos.some(pp => ['K', 'P'].includes(pp))) {
      s.fgm += qs.fg_made     ?? 0
      s.fga += qs.fg_attempts ?? 0
      s.epm += qs.ep_made     ?? 0
      s.epa += qs.ep_attempts ?? 0
    }
  })
  s.totalYds = s.passYds + s.rushYds
  return s
}

/* ════════════════════════════════════════════
   Main overlay page — renders BOTH overlays
   on the same browser source
════════════════════════════════════════════ */
export default function LowerThirdOverlay() {
  /* ── Player lower-third state ── */
  const [player, setPlayer]             = useState<any>(null)
  const [playerStats, setPlayerStats]   = useState<any>(null)
  const [overlayState, setOverlayState] = useState<OverlayStateRow | null>(null)
  const [playerVisible, setPlayerVisible] = useState(false)

  /* ── Team stats state ── */
  const [teamState, setTeamState]           = useState<TeamOverlayStateRow | null>(null)
  const [homeTeam, setHomeTeam]             = useState<any>(null)
  const [awayTeam, setAwayTeam]             = useState<any>(null)
  const [gameMeta, setGameMeta]             = useState<{ home_score: number|null; away_score: number|null; status: string } | null>(null)
  const [homePlayers, setHomePlayers]       = useState<any[]>([])
  const [awayPlayers, setAwayPlayers]       = useState<any[]>([])
  const [teamGameStats, setTeamGameStats]   = useState<any[]>([])
  const [teamVisible, setTeamVisible]       = useState(false)

  /* ── Player overlay subscription ── */
  useEffect(() => {
    const supabase = createClient()

    async function loadPlayer(newState?: OverlayStateRow) {
      let state = newState
      if (!state) {
        const { data } = await supabase.from('overlay_state').select('*').eq('id', 1).single()
        if (!data) return
        state = data as OverlayStateRow
      }
      setOverlayState(state)
      setPlayerVisible(state.visible)
      if (!state.active_player_id) { setPlayer(null); setPlayerStats(null); return }

      const { data: p } = await supabase
        .from('players').select('*, team:teams(*)').eq('id', state.active_player_id).single()
      setPlayer(p)

      if (state.mode === 'live' && state.game_id) {
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
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  /* ── Team stats subscription ── */
  useEffect(() => {
    const supabase = createClient()

    async function loadTeam(newState?: TeamOverlayStateRow) {
      let s = newState
      if (!s) {
        const { data } = await supabase.from('team_overlay_state').select('*').eq('id', 1).single()
        if (!data) return
        s = data as TeamOverlayStateRow
      }
      setTeamState(s)
      setTeamVisible(s.visible)
      if (!s.game_id) return

      const { data: game } = await supabase
        .from('games')
        .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
        .eq('id', s.game_id).single()
      if (!game) return

      setHomeTeam((game as any).home_team ?? null)
      setAwayTeam((game as any).away_team ?? null)
      setGameMeta({ home_score: (game as any).home_score ?? null, away_score: (game as any).away_score ?? null, status: (game as any).status ?? '' })

      const teamIds = [(game as any).home_team?.id, (game as any).away_team?.id].filter(Boolean)
      const [{ data: players }, { data: gs }] = await Promise.all([
        supabase.from('players').select('*').in('team_id', teamIds),
        supabase.from('game_stats').select('*').eq('game_id', s.game_id),
      ])
      setHomePlayers((players ?? []).filter((p: any) => p.team_id === (game as any).home_team?.id))
      setAwayPlayers((players ?? []).filter((p: any) => p.team_id === (game as any).away_team?.id))
      setTeamGameStats(gs ?? [])
    }

    loadTeam()
    const ch = supabase.channel('lower-third-team')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_overlay_state' },
        ({ new: row }) => loadTeam(row as TeamOverlayStateRow))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats' },
        () => loadTeam())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  /* ── Derived values ── */
  const team          = player?.team
  const pos: string[] = player?.positions ?? []
  const statItems     = buildStats(pos, playerStats)
  const hasStats      = statItems.length > 0

  const primaryColor   = team?.primary_color  ?? '#ff1d25'
  const onPrimary      = textOn(primaryColor)
  const dimOnPrimary   = onPrimary === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.50)'
  const hairline       = onPrimary === '#ffffff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'

  const homeStats = calcTeamStats(homePlayers, teamGameStats)
  const awayStats = calcTeamStats(awayPlayers, teamGameStats)
  const PLAYER_BOTTOM = 56  // px from bottom of screen

  /* ── Team stats fullscreen layout constants ── */
  const TW = 1760, TH = 900
  const HEADER_H = 112, LOGO_W = 300
  const hC = homeTeam?.primary_color ?? '#1a1a2e'
  const aC = awayTeam?.primary_color ?? '#2e1a1a'
  const hT = textOn(hC), aT = textOn(awayTeam?.primary_color ?? '#2e1a1a')
  const homeDim = hT === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
  const awayDim = aT === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'
  const statusLabel = gameMeta?.status === 'live' ? 'LIVE' : gameMeta?.status === 'final' ? 'FINAL' : null

  type TStat = { label: string; h: string|number; a: string|number; accent?: string }
  const STAT_ROWS: TStat[] = [
    { label: 'PASS YDS',    h: homeStats.passYds,  a: awayStats.passYds  },
    { label: 'RUSH YDS',    h: homeStats.rushYds,  a: awayStats.rushYds  },
    { label: 'TOTAL YDS',   h: homeStats.totalYds, a: awayStats.totalYds },
    { label: 'REC / TAR',   h: `${homeStats.receptions}/${homeStats.targets}`, a: `${awayStats.receptions}/${awayStats.targets}` },
    { label: 'TOTAL TDs',   h: homeStats.tds,  a: awayStats.tds,  accent: '#04a550' },
    { label: 'FIELD GOALS', h: homeStats.fgm,  a: awayStats.fgm  },
    { label: 'INT',         h: homeStats.ints, a: awayStats.ints, accent: '#ff1d25' },
    { label: 'FUMBLES',     h: homeStats.fumbles, a: awayStats.fumbles, accent: '#f59e0b' },
  ]
  const N_ROWS = STAT_ROWS.length

  return (
    <>
      {/* ══ PLAYER LOWER-THIRD ══ */}
      <div style={{
        position: 'absolute',
        bottom: PLAYER_BOTTOM,
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

      {/* ══ TEAM STATS OVERLAY — fullscreen comparison ══ */}
      <div style={{
        position: 'absolute',
        top:  (1080 - TH) / 2,
        left: (1920 - TW) / 2,
        width: TW, height: TH,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 40px 120px rgba(0,0,0,0.95), 0 8px 40px rgba(0,0,0,0.8)',
        opacity: teamVisible ? 1 : 0,
        transform: teamVisible ? 'scale(1)' : 'scale(0.96)',
        transition: 'opacity 0.45s cubic-bezier(0.22,1,0.36,1), transform 0.45s cubic-bezier(0.22,1,0.36,1)',
        pointerEvents: 'none',
      }}>
        {/* Header: score */}
        <div style={{ height: HEADER_H, flexShrink: 0, background: '#06080f', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: hC }} />
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, background: aC }} />
          {/* Home */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 18, paddingRight: 48 }}>
            {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 52, height: 52, objectFit: 'contain', opacity: 0.9 }} />}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontFamily: 'Arial', lineHeight: 1 }}>HOME</div>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 1, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1.2, marginTop: 2 }}>{homeTeam?.short_name?.toUpperCase() ?? '—'}</div>
            </div>
            <div style={{ fontSize: 62, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: -2, lineHeight: 1, textShadow: `0 0 30px ${hC}80` }}>
              {gameMeta?.home_score ?? 0}
            </div>
          </div>
          {/* Center */}
          <div style={{ width: 200, textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 4, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', fontFamily: '"Arial Black", sans-serif' }}>TEAM STATS</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'rgba(255,255,255,0.15)', fontFamily: '"Arial Black", sans-serif', lineHeight: 1, marginTop: 2 }}>—</div>
            {statusLabel && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 3, color: gameMeta?.status === 'live' ? '#ff1d25' : '#04a550', textTransform: 'uppercase', fontFamily: '"Arial Black", sans-serif' }}>{statusLabel}</div>}
          </div>
          {/* Away */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 18, paddingLeft: 48 }}>
            <div style={{ fontSize: 62, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: -2, lineHeight: 1, textShadow: `0 0 30px ${aC}80` }}>
              {gameMeta?.away_score ?? 0}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontFamily: 'Arial', lineHeight: 1 }}>AWAY</div>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 1, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1.2, marginTop: 2 }}>{awayTeam?.short_name?.toUpperCase() ?? '—'}</div>
            </div>
            {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 52, height: 52, objectFit: 'contain', opacity: 0.9 }} />}
          </div>
        </div>

        {/* Body: logo panels + stats */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Home panel */}
          <div style={{ width: LOGO_W, flexShrink: 0, background: hC, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${lum(hC) > 0.3 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'} 0%, transparent 70%)` }} />
            {homeTeam?.logo_url
              ? <img src={homeTeam.logo_url} alt="" style={{ width: 200, height: 200, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.45))' }} />
              : <div style={{ fontSize: 56, fontWeight: 900, color: hT, fontFamily: '"Arial Black", sans-serif', position: 'relative', zIndex: 1 }}>{homeTeam?.short_name ?? '—'}</div>}
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 12px' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: hT, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.5, lineHeight: 1, textTransform: 'uppercase' }}>{homeTeam?.short_name}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: homeDim, letterSpacing: 3, marginTop: 5, textTransform: 'uppercase', fontFamily: 'Arial' }}>{homeTeam?.name}</div>
            </div>
          </div>

          {/* Center stats */}
          <div style={{ flex: 1, background: '#080b14', display: 'flex', flexDirection: 'column' }}>
            {STAT_ROWS.map(({ label, h, a, accent }, i) => {
              const hNum = typeof h === 'number' ? h : null, aNum = typeof a === 'number' ? a : null
              const hWins = hNum !== null && aNum !== null && hNum > aNum
              const aWins = hNum !== null && aNum !== null && aNum > hNum
              const rowH  = (TH - HEADER_H) / N_ROWS
              const hi    = accent ?? '#ffffff'
              return (
                <div key={label} style={{ height: rowH, flexShrink: 0, display: 'flex', alignItems: 'center', background: i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent', borderBottom: i < N_ROWS - 1 ? '1px solid rgba(255,255,255,0.038)' : 'none', padding: '0 12px', position: 'relative' }}>
                  {hWins && <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: hi, borderRadius: '0 2px 2px 0', opacity: 0.7 }} />}
                  {aWins && <div style={{ position: 'absolute', right: 0, top: '20%', bottom: '20%', width: 3, background: hi, borderRadius: '2px 0 0 2px', opacity: 0.7 }} />}
                  <div style={{ flex: 1, textAlign: 'right', paddingRight: 36 }}>
                    <span style={{ fontSize: hWins ? 40 : 34, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', color: hWins ? hi : 'rgba(255,255,255,0.55)', letterSpacing: -0.5, lineHeight: 1, textShadow: hWins && accent ? `0 0 24px ${accent}50` : 'none' }}>{h}</span>
                  </div>
                  <div style={{ width: 150, textAlign: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', fontFamily: '"Arial Black", Arial, sans-serif' }}>{label}</span>
                  </div>
                  <div style={{ flex: 1, textAlign: 'left', paddingLeft: 36 }}>
                    <span style={{ fontSize: aWins ? 40 : 34, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', color: aWins ? hi : 'rgba(255,255,255,0.55)', letterSpacing: -0.5, lineHeight: 1, textShadow: aWins && accent ? `0 0 24px ${accent}50` : 'none' }}>{a}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Away panel */}
          <div style={{ width: LOGO_W, flexShrink: 0, background: aC, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${lum(aC) > 0.3 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'} 0%, transparent 70%)` }} />
            {awayTeam?.logo_url
              ? <img src={awayTeam.logo_url} alt="" style={{ width: 200, height: 200, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.45))' }} />
              : <div style={{ fontSize: 56, fontWeight: 900, color: aT, fontFamily: '"Arial Black", sans-serif', position: 'relative', zIndex: 1 }}>{awayTeam?.short_name ?? '—'}</div>}
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 12px' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: aT, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.5, lineHeight: 1, textTransform: 'uppercase' }}>{awayTeam?.short_name}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: awayDim, letterSpacing: 3, marginTop: 5, textTransform: 'uppercase', fontFamily: 'Arial' }}>{awayTeam?.name}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
