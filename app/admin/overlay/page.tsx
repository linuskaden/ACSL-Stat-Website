'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ─── Types ─── */
type Team = { id: string; name: string; short_name: string; slug: string; primary_color: string; secondary_color: string; logo_url: string | null }
type Player = { id: string; first_name: string; last_name: string; nickname: string | null; jersey_number: string | null; positions: string[]; team_id: string; is_active: boolean; height_cm: number | null; weight_kg: number | null; country: string | null; hometown: string | null; field_of_study: string | null; semester: string | null; acsl_since: string | null; fun_fact: string | null; football_experience: string | null }
type Game = { id: string; status: 'scheduled' | 'live' | 'final'; game_type: string; season: number; home_score: number | null; away_score: number | null; scheduled_at: string | null; home_team: Team; away_team: Team | null }
type OverlayState = { active_player_id: string | null; game_id: string | null; mode: 'live' | 'career'; visible: boolean }

const POSITIONS = ['Alle', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P']

type TeamOverlayState = { game_id: string | null; display_team: 'both' | 'home' | 'away'; visible: boolean }

export default function OverlayControlPage() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [homePlayers, setHomePlayers] = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([])
  const [overlay, setOverlay] = useState<OverlayState>({ active_player_id: null, game_id: null, mode: 'live', visible: false })
  const [teamOverlay, setTeamOverlay] = useState<TeamOverlayState>({ game_id: null, display_team: 'both', visible: false })
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [careerStats, setCareerStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [searchHome, setSearchHome] = useState('')
  const [searchAway, setSearchAway] = useState('')
  const [filterHome, setFilterHome] = useState('Alle')
  const [filterAway, setFilterAway] = useState('Alle')
  const [previewStats, setPreviewStats] = useState<any>(null)
  const [gameStatsRows, setGameStatsRows] = useState<any[]>([])
  const [overlayUrl, setOverlayUrl] = useState('')
  const [teamOverlayUrl, setTeamOverlayUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedTeam, setCopiedTeam] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingTeam, setSavingTeam] = useState(false)

  useEffect(() => {
    setOverlayUrl(`${window.location.origin}/overlay/lower-third`)
    setTeamOverlayUrl(`${window.location.origin}/overlay/team-stats`)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const [{ data: gs }, { data: os }, { data: tos }] = await Promise.all([
        supabase.from('games').select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)').eq('season', 2026).order('scheduled_at', { ascending: false }),
        supabase.from('overlay_state').select('*').eq('id', 1).single(),
        supabase.from('team_overlay_state').select('*').eq('id', 1).single(),
      ])
      if (gs) setGames(gs as Game[])
      if (os) setOverlay(os as OverlayState)
      if (tos) setTeamOverlay(tos as TeamOverlayState)
      const list = (gs ?? []) as Game[]
      const auto = list.find(g => g.status === 'live') ?? (os?.game_id ? list.find(g => g.id === os.game_id) : null) ?? null
      if (auto) { setSelectedGame(auto); loadPlayers(auto) }
    }
    init()
  }, []) // eslint-disable-line

  async function loadPlayers(game: Game) {
    const supabase = createClient()
    const teamIds = [game.home_team.id, game.away_team?.id].filter(Boolean) as string[]
    const [{ data: players }, { data: gs }] = await Promise.all([
      supabase.from('players').select('*').in('team_id', teamIds).eq('is_active', true).order('jersey_number', { nullsFirst: false }),
      supabase.from('game_stats').select('*').eq('game_id', game.id),
    ])
    if (players) {
      setHomePlayers((players as Player[]).filter(p => p.team_id === game.home_team.id))
      setAwayPlayers(game.away_team ? (players as Player[]).filter(p => p.team_id === game.away_team!.id) : [])
    }
    setGameStatsRows(gs ?? [])
  }

  // Load career stats when player selected (for modal)
  useEffect(() => {
    if (!selectedPlayer) { setCareerStats(null); return }
    setLoadingStats(true)
    const supabase = createClient()
    supabase.from('career_stats').select('*').eq('player_id', selectedPlayer.id).order('season', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { setCareerStats(data); setLoadingStats(false) })
  }, [selectedPlayer?.id])

  // Load preview stats for the ACTIVE overlay player (realtime)
  useEffect(() => {
    if (!overlay.active_player_id) { setPreviewStats(null); return }
    const supabase = createClient()

    async function loadPreview() {
      if (overlay.mode === 'live' && overlay.game_id) {
        const { data } = await supabase.from('game_stats').select('*')
          .eq('game_id', overlay.game_id).eq('player_id', overlay.active_player_id)
        if (data && data.length > 0) {
          const totals: Record<string, number> = {}
          data.forEach((row: any) => Object.entries(row).forEach(([k, v]) => { if (typeof v === 'number') totals[k] = (totals[k] ?? 0) + v }))
          setPreviewStats(totals)
        } else setPreviewStats({})
      } else {
        const { data } = await supabase.from('career_stats').select('*')
          .eq('player_id', overlay.active_player_id).order('season', { ascending: false }).limit(1).maybeSingle()
        setPreviewStats(data ?? {})
      }
    }

    loadPreview()

    // Subscribe so preview updates in real-time as stats come in
    const ch = supabase.channel('preview-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats' }, loadPreview)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [overlay.active_player_id, overlay.game_id, overlay.mode])

  const pushOverlay = useCallback(async (patch: Partial<OverlayState>) => {
    const supabase = createClient()
    const next = { ...overlay, ...patch }
    setOverlay(next)
    setSaving(true)
    await supabase.from('overlay_state').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
    setSaving(false)
  }, [overlay])

  const pushTeamOverlay = useCallback(async (patch: Partial<TeamOverlayState>) => {
    const supabase = createClient()
    setTeamOverlay(prev => ({ ...prev, ...patch }))
    setSavingTeam(true)
    await supabase.from('team_overlay_state').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
    setSavingTeam(false)
  }, [])

  async function handleGameChange(gameId: string) {
    const game = games.find(g => g.id === gameId)
    if (!game) return
    setSelectedGame(game); loadPlayers(game)
    if (overlay.active_player_id) pushOverlay({ game_id: gameId })
    pushTeamOverlay({ game_id: gameId })
  }

  async function showOnOverlay(player: Player, mode: 'live' | 'career') {
    await pushOverlay({ active_player_id: player.id, game_id: selectedGame?.id ?? overlay.game_id, mode, visible: true })
  }

  function copyUrl() {
    navigator.clipboard.writeText(overlayUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  function copyTeamUrl() {
    navigator.clipboard.writeText(teamOverlayUrl).then(() => { setCopiedTeam(true); setTimeout(() => setCopiedTeam(false), 2000) })
  }

  function filterPlayers(players: Player[], search: string, filter: string) {
    const q = search.toLowerCase()
    return players.filter(p => {
      const matchSearch = !q || [p.first_name, p.last_name, String(p.jersey_number ?? ''), ...p.positions].some(v => v.toLowerCase().includes(q))
      const matchPos = filter === 'Alle' || p.positions.includes(filter)
      return matchSearch && matchPos
    })
  }

  const gameLabel = (g: Game) =>
    `${g.home_team?.short_name ?? '?'} vs ${g.away_team?.short_name ?? '?'}${g.status !== 'scheduled' ? ` ${g.home_score ?? 0}–${g.away_score ?? 0}` : ''} · ${g.game_type?.replace('_', ' ')}${g.status === 'live' ? ' 🔴' : ''}`

  const filteredHome = filterPlayers(homePlayers, searchHome, filterHome)
  const filteredAway = filterPlayers(awayPlayers, searchAway, filterAway)
  const activePlayer = [...homePlayers, ...awayPlayers].find(p => p.id === overlay.active_player_id)

  return (
    <div className="min-h-screen bg-[#0c0f1a] text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ══ Top bar ══ */}
      <div className="sticky top-0 z-20 bg-[#080b14] border-b border-white/5 px-5 py-3 flex flex-wrap items-center gap-4">
        <div>
          <div className="text-base font-black tracking-tight">vMix Overlay Control</div>
          <div className="text-[11px] text-[#555] mt-0.5">ACSL Media — Lower Third Player Card</div>
        </div>

        {/* Game */}
        <select value={selectedGame?.id ?? ''} onChange={e => handleGameChange(e.target.value)}
          className="bg-[#131826] border border-white/8 rounded-lg px-3 py-2 text-white text-xs outline-none flex-1 min-w-[200px] max-w-xs">
          <option value="">Spiel auswählen…</option>
          {games.map(g => <option key={g.id} value={g.id}>{gameLabel(g)}</option>)}
        </select>

        {/* Mode */}
        <div className="flex rounded-lg overflow-hidden border border-white/8">
          {(['live', 'career'] as const).map(m => (
            <button key={m} onClick={() => pushOverlay({ mode: m })}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all"
              style={{ background: overlay.mode === m ? '#ff1d25' : '#131826', color: overlay.mode === m ? 'white' : '#666' }}>
              {m === 'live' ? '⚡ Live' : '📊 Career'}
            </button>
          ))}
        </div>

        {/* Show/Hide */}
        <button onClick={() => pushOverlay({ visible: !overlay.visible })}
          className="px-5 py-2 text-xs font-black rounded-lg transition-all"
          style={{
            background: overlay.visible ? 'rgba(4,165,80,0.15)' : 'rgba(255,255,255,0.04)',
            color: overlay.visible ? '#04a550' : '#888',
            border: `1px solid ${overlay.visible ? '#04a550' : 'rgba(255,255,255,0.1)'}`,
            boxShadow: overlay.visible ? '0 0 12px rgba(4,165,80,0.2)' : 'none',
          }}>
          {overlay.visible ? '▼ HIDE' : '▲ SHOW'}
        </button>

        {/* Status */}
        <div className="flex items-center gap-2 ml-auto">
          {saving && <span className="text-[10px] text-[#444] tracking-wider">saving…</span>}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full transition-all" style={{ background: overlay.visible ? '#04a550' : '#333', boxShadow: overlay.visible ? '0 0 6px #04a550' : 'none' }} />
            <span className="text-[11px] font-bold tracking-widest" style={{ color: overlay.visible ? '#04a550' : '#555' }}>
              {overlay.visible ? 'ON AIR' : 'HIDDEN'}
            </span>
          </div>
        </div>

        {/* vMix URL */}
        <div className="flex items-center gap-2">
          <code className="bg-[#131826] border border-white/7 rounded px-2 py-1.5 text-[11px] text-[#888] whitespace-nowrap">
            {overlayUrl || '…'}
          </code>
          <button onClick={copyUrl} className="px-3 py-1.5 text-[11px] font-bold rounded transition-all"
            style={{ background: copied ? '#04a550' : '#1a2040', color: copied ? 'white' : '#888', border: '1px solid rgba(255,255,255,0.08)' }}>
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      {/* ══ Active player banner ══ */}
      {activePlayer && (
        <div className="bg-[#0f1420] border-b border-white/5 px-5 py-3 flex items-center gap-3">
          <div className="w-2 h-8 rounded-full" style={{ background: [...homePlayers].find(p => p.id === activePlayer.id) ? selectedGame?.home_team.primary_color : selectedGame?.away_team?.primary_color ?? '#ff1d25' }} />
          <div>
            <div className="text-[10px] text-[#555] font-bold tracking-widest uppercase mb-0.5">Now on Overlay</div>
            <div className="font-black text-white text-sm">
              {activePlayer.jersey_number && <span className="text-[#555] mr-1.5">#{activePlayer.jersey_number}</span>}
              {activePlayer.first_name} {activePlayer.last_name}
              <span className="text-[#555] text-xs font-normal ml-2">{activePlayer.positions.join(' / ')}</span>
            </div>
          </div>
          <div className="ml-auto">
            <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded"
              style={{ background: overlay.mode === 'live' ? 'rgba(255,29,37,0.12)' : 'rgba(255,255,255,0.05)', color: overlay.mode === 'live' ? '#ff1d25' : '#888' }}>
              {overlay.mode === 'live' ? '⚡ GAME STATS' : '📊 SEASON'}
            </span>
          </div>
        </div>
      )}

      {/* ══ Operator Preview ══ */}
      <OperatorPreview
        player={activePlayer ?? null}
        team={activePlayer
          ? (homePlayers.find(p => p.id === activePlayer.id) ? selectedGame?.home_team ?? null : selectedGame?.away_team ?? null)
          : null}
        stats={previewStats}
        mode={overlay.mode}
        visible={overlay.visible}
        teamOverlay={teamOverlay}
        homeTeam={selectedGame?.home_team ?? null}
        awayTeam={selectedGame?.away_team ?? null}
        homePlayers={homePlayers}
        awayPlayers={awayPlayers}
        gameStatsRows={gameStatsRows}
      />

      {/* ══ Team Stats Overlay Control ══ */}
      <TeamStatsControl
        teamOverlay={teamOverlay}
        selectedGame={selectedGame}
        onPush={pushTeamOverlay}
        saving={savingTeam}
        overlayUrl={teamOverlayUrl}
        copied={copiedTeam}
        onCopy={copyTeamUrl}
      />

      {/* ══ Player grid – two columns ══ */}
      {selectedGame ? (
        <div className="flex gap-0 flex-1" style={{ minHeight: 'calc(100vh - 120px)' }}>

          {/* Home team */}
          <TeamColumn
            team={selectedGame.home_team}
            players={filteredHome}
            allPlayers={homePlayers}
            label="HOME"
            search={searchHome}
            onSearch={setSearchHome}
            filter={filterHome}
            onFilter={setFilterHome}
            activeId={overlay.active_player_id}
            onSelect={p => setSelectedPlayer(p)}
            selectedId={selectedPlayer?.id ?? null}
          />

          {/* Divider */}
          <div className="w-px bg-white/5 flex-shrink-0" />

          {/* Away team */}
          <TeamColumn
            team={selectedGame.away_team}
            players={filteredAway}
            allPlayers={awayPlayers}
            label="AWAY"
            search={searchAway}
            onSearch={setSearchAway}
            filter={filterAway}
            onFilter={setFilterAway}
            activeId={overlay.active_player_id}
            onSelect={p => setSelectedPlayer(p)}
            selectedId={selectedPlayer?.id ?? null}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
          <div className="text-[#333] text-sm">Wähle ein Spiel aus um Spieler zu sehen</div>
        </div>
      )}

      {/* ══ Player detail modal ══ */}
      {selectedPlayer && (
        <PlayerModal
          player={selectedPlayer}
          team={[...homePlayers, ...awayPlayers].find(p => p.id === selectedPlayer.id)
            ? (homePlayers.find(p => p.id === selectedPlayer.id) ? selectedGame?.home_team : selectedGame?.away_team)
            : null}
          careerStats={careerStats}
          loadingStats={loadingStats}
          overlayActiveId={overlay.active_player_id}
          overlayVisible={overlay.visible}
          overlayMode={overlay.mode}
          onClose={() => setSelectedPlayer(null)}
          onShow={(mode) => showOnOverlay(selectedPlayer, mode)}
          onHide={() => pushOverlay({ visible: false })}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────
   Stat builder (shared)
───────────────────────────────── */
function buildStatItems(positions: string[], s: any): { label: string; value: string | number }[] {
  if (!s) return []
  const items: { label: string; value: string | number }[] = []
  const hasKP  = positions.some((p: string) => ['K', 'P'].includes(p))
  const hasDef = positions.some((p: string) => ['DB', 'LB', 'DL', 'OL'].includes(p))

  if (positions.includes('QB')) {
    items.push(
      { label: 'PASS YDS', value: s.pass_yards ?? 0 },
      { label: 'TDs', value: (s.pass_tds ?? 0) + (s.qb_rush_tds ?? 0) },
      { label: 'INT', value: s.interceptions_thrown ?? 0 },
      { label: 'C/ATT', value: `${s.pass_completions ?? 0}/${s.pass_attempts ?? 0}` },
      { label: 'RUSH', value: s.qb_rush_yards ?? 0 },
    )
  } else if (positions.includes('RB')) {
    items.push(
      { label: 'RUSH YDS', value: s.rush_yards ?? 0 },
      { label: 'TDs', value: s.rush_tds ?? 0 },
      { label: 'CAR', value: s.rush_carries ?? 0 },
      { label: 'REC YDS', value: s.rb_rec_yards ?? 0 },
      { label: 'REC', value: s.rb_receptions ?? 0 },
    )
  } else if (positions.some((p: string) => ['WR', 'TE'].includes(p))) {
    items.push(
      { label: 'REC YDS', value: s.rec_yards ?? 0 },
      { label: 'TDs', value: s.rec_tds ?? 0 },
      { label: 'REC', value: s.receptions ?? 0 },
      { label: 'TAR', value: s.rec_targets ?? 0 },
    )
  } else {
    if (hasDef || !hasKP) {
      items.push(
        { label: 'SACKS', value: s.sacks ?? 0 },
        { label: 'INT', value: s.def_interceptions ?? 0 },
      )
    }
  }

  if (hasKP) {
    items.push(
      { label: 'FG', value: `${s.fg_made ?? 0}/${s.fg_attempts ?? 0}` },
      { label: 'EP', value: `${s.ep_made ?? 0}/${s.ep_attempts ?? 0}` },
      { label: 'PTS', value: (s.fg_made ?? 0) * 3 + (s.ep_made ?? 0) },
    )
  }

  return items
}

/* ─────────────────────────────────
   Shared helper: readable text on colored bg
───────────────────────────────── */
function textOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.48 ? '#000000' : '#ffffff'
}

/* ─────────────────────────────────
   Operator Preview
───────────────────────────────── */
/* ─── Team stats calc (mirrors overlay logic) ─── */
function calcTeamTotals(players: Player[], gsRows: any[]) {
  let passYds = 0, rushYds = 0, recYds = 0, tds = 0, ints = 0, fumbles = 0, targets = 0, receptions = 0
  let fgm = 0, fga = 0, epm = 0, epa = 0
  players.forEach(p => {
    const rows = gsRows.filter(r => r.player_id === p.id)
    const qs: Record<string, number> = {}
    rows.forEach(r => Object.entries(r).forEach(([k, v]) => { if (typeof v === 'number') qs[k] = (qs[k] ?? 0) + v }))
    const pos = p.positions as string[]
    if (pos.includes('QB')) {
      passYds += qs.pass_yards ?? 0; rushYds += qs.qb_rush_yards ?? 0
      tds += (qs.pass_tds ?? 0) + (qs.qb_rush_tds ?? 0); ints += qs.interceptions_thrown ?? 0
    } else if (pos.includes('RB')) {
      rushYds += qs.rush_yards ?? 0; recYds += qs.rb_rec_yards ?? 0
      tds += qs.rush_tds ?? 0; fumbles += qs.rb_fumbles ?? 0
      targets += qs.rb_targets ?? 0; receptions += qs.rb_receptions ?? 0
    } else if (pos.some(pp => ['WR', 'TE'].includes(pp))) {
      recYds += qs.rec_yards ?? 0; fumbles += qs.rec_fumbles ?? 0
      targets += qs.rec_targets ?? 0; receptions += qs.receptions ?? 0
    }
    if (pos.some(pp => ['K', 'P'].includes(pp))) {
      fgm += qs.fg_made ?? 0; fga += qs.fg_attempts ?? 0
      epm += qs.ep_made ?? 0; epa += qs.ep_attempts ?? 0
    }
  })
  const totalYds = passYds + rushYds
  const catchPct = targets > 0 ? Math.round(receptions / targets * 100) : 0
  return { passYds, rushYds, recYds, totalYds, tds, ints, fumbles, targets, receptions, catchPct, fgm, fga, epm, epa }
}

function OperatorPreview({ player, team, stats, mode, visible,
  teamOverlay, homeTeam, awayTeam, homePlayers, awayPlayers, gameStatsRows }: {
  player: Player | null
  team: Team | null | undefined
  stats: any
  mode: 'live' | 'career'
  visible: boolean
  teamOverlay: TeamOverlayState
  homeTeam: Team | null | undefined
  awayTeam: Team | null | undefined
  homePlayers: Player[]
  awayPlayers: Player[]
  gameStatsRows: any[]
}) {
  const primaryColor   = team?.primary_color   ?? '#ff1d25'
  const secondaryColor = team?.secondary_color ?? '#ffffff'
  const onPrimary      = team ? textOn(primaryColor) : '#ffffff'
  const dimOnPrimary   = onPrimary === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.50)'
  const hairline       = onPrimary === '#ffffff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'
  const statItems      = player ? buildStatItems(player.positions, stats) : []
  const modeLabel      = mode === 'career' ? '2026 SEASON' : 'GAME STATS'
  const hasStats       = statItems.length > 0

  return (
    <div style={{
      background: '#080b14',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 20px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#444', textTransform: 'uppercase' }}>
          Overlay Vorschau
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: visible ? '#04a550' : '#333',
            boxShadow: visible ? '0 0 6px #04a550' : 'none',
            transition: 'all 0.3s',
          }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: visible ? '#04a550' : '#444', textTransform: 'uppercase' }}>
            {visible ? 'On Air' : 'Hidden'}
          </span>
        </div>
      </div>

      {/* Broadcast mock frame */}
      <div style={{
        background: '#131825',
        borderRadius: 8,
        padding: '20px 20px 20px 20px',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 88,
        display: 'flex',
        alignItems: 'flex-end',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 15% 50%, rgba(255,255,255,0.012) 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', top: 7, right: 10, fontSize: 8, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.06)', textTransform: 'uppercase' }}>
          ACSL Broadcast
        </div>

        {/* Team stats — scaled-down fullscreen comparison preview */}
        {teamOverlay.visible && (homeTeam || awayTeam) && (() => {
          const hS = calcTeamTotals(homePlayers, gameStatsRows)
          const aS = calcTeamTotals(awayPlayers, gameStatsRows)
          const hC = homeTeam?.primary_color ?? '#1a1a2e'
          const aC = awayTeam?.primary_color ?? '#2e1a1a'
          const hT = textOn(hC), aT = textOn(aC)
          const W = 1760, H = 900, SCALE = 0.235
          const sw = Math.round(W * SCALE), sh = Math.round(H * SCALE)
          const HEADER_H = 112, LOGO_W = 300, N = 8
          const STAT_ROWS = [
            { label: 'PASS YDS',  h: hS.passYds,  a: aS.passYds  },
            { label: 'RUSH YDS',  h: hS.rushYds,  a: aS.rushYds  },
            { label: 'TOTAL YDS', h: hS.totalYds, a: aS.totalYds },
            { label: 'REC/TAR',   h: `${hS.receptions}/${hS.targets}`, a: `${aS.receptions}/${aS.targets}` },
            { label: 'TOTAL TDs', h: hS.tds,    a: aS.tds,    accent: '#04a550' },
            { label: 'FIELD GOALS',h: hS.fgm,   a: aS.fgm   },
            { label: 'INT',        h: hS.ints,   a: aS.ints,   accent: '#ff1d25' },
            { label: 'FUMBLES',    h: hS.fumbles,a: aS.fumbles,accent: '#f59e0b' },
          ]
          return (
            <div style={{ width: sw, height: sh, overflow: 'hidden', marginBottom: 8, flexShrink: 0, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
              <div style={{ width: W, height: H, transform: `scale(${SCALE})`, transformOrigin: 'top left', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ height: HEADER_H, flexShrink: 0, background: '#06080f', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: hC }} />
                  <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, background: aC }} />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, paddingRight: 48 }}>
                    {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} />}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', fontFamily: 'Arial' }}>HOME · {homeTeam?.short_name?.toUpperCase()}</div>
                    </div>
                    <div style={{ fontSize: 62, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1, textShadow: `0 0 30px ${hC}80` }}>0</div>
                  </div>
                  <div style={{ width: 180, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 4, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', fontFamily: '"Arial Black"' }}>TEAM STATS</div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 16, paddingLeft: 48 }}>
                    <div style={{ fontSize: 62, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1, textShadow: `0 0 30px ${aC}80` }}>0</div>
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', fontFamily: 'Arial' }}>AWAY · {awayTeam?.short_name?.toUpperCase()}</div>
                    </div>
                    {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} />}
                  </div>
                </div>
                {/* Body */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {/* Home panel */}
                  <div style={{ width: LOGO_W, flexShrink: 0, background: hC, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 45%, rgba(255,255,255,0.1) 0%, transparent 70%)` }} />
                    {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 180, height: 180, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))' }} />}
                    <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: hT, fontFamily: '"Arial Black"', textTransform: 'uppercase' }}>{homeTeam?.short_name}</div>
                    </div>
                  </div>
                  {/* Stats */}
                  <div style={{ flex: 1, background: '#080b14', display: 'flex', flexDirection: 'column' }}>
                    {STAT_ROWS.map(({ label, h, a, accent }, i) => {
                      const hNum = typeof h === 'number' ? h : null, aNum = typeof a === 'number' ? a : null
                      const hW = hNum !== null && aNum !== null && hNum > aNum
                      const aW = hNum !== null && aNum !== null && aNum > hNum
                      const hi = accent ?? '#fff'
                      return (
                        <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', background: i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent', borderBottom: i < N - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', padding: '0 8px' }}>
                          <div style={{ flex: 1, textAlign: 'right', paddingRight: 32 }}>
                            <span style={{ fontSize: hW ? 38 : 32, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', color: hW ? hi : 'rgba(255,255,255,0.55)', lineHeight: 1 }}>{h}</span>
                          </div>
                          <div style={{ width: 150, textAlign: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', fontFamily: '"Arial Black"' }}>{label}</span>
                          </div>
                          <div style={{ flex: 1, textAlign: 'left', paddingLeft: 32 }}>
                            <span style={{ fontSize: aW ? 38 : 32, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', color: aW ? hi : 'rgba(255,255,255,0.55)', lineHeight: 1 }}>{a}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Away panel */}
                  <div style={{ width: LOGO_W, flexShrink: 0, background: aC, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 45%, rgba(255,255,255,0.1) 0%, transparent 70%)` }} />
                    {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 180, height: 180, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))' }} />}
                    <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: aT, fontFamily: '"Arial Black"', textTransform: 'uppercase' }}>{awayTeam?.short_name}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {player && team ? (
          <div style={{
            display: 'inline-flex',
            flexDirection: 'column',
            boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
            opacity: visible ? 1 : 0.3,
            filter: visible ? 'none' : 'grayscale(0.6)',
            transition: 'opacity 0.4s, filter 0.4s',
          }}>
            {/* Nameplate */}
            <div style={{ display: 'flex', alignItems: 'stretch', background: primaryColor, height: 62 }}>
              {/* Logo */}
              <div style={{ width: 62, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, flexShrink: 0 }}>
                {team.logo_url
                  ? <img src={team.logo_url} alt="" style={{ width: 50, height: 50, objectFit: 'contain' }} />
                  : <div style={{ width: 50, height: 50, borderRadius: 3, background: hairline }} />}
              </div>
              {/* Divider */}
              <div style={{ width: 1, background: hairline, margin: '10px 0', flexShrink: 0 }} />
              {/* Info */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 16px', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, lineHeight: 1 }}>
                  {player.jersey_number != null && (
                    <span style={{ color: dimOnPrimary, fontSize: 13, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif' }}>
                      #{player.jersey_number}
                    </span>
                  )}
                  <span style={{ color: onPrimary, fontSize: 18, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', whiteSpace: 'nowrap', letterSpacing: 0.3 }}>
                    {player.first_name.toUpperCase()} {player.last_name.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ color: onPrimary, fontSize: 9, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', background: hairline, padding: '2px 5px', borderRadius: 2 }}>
                    {player.positions.join(' · ')}
                  </span>
                  <span style={{ color: hairline, fontSize: 10 }}>·</span>
                  <span style={{ color: dimOnPrimary, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    {team.short_name}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats bar */}
            {hasStats && (
              <div style={{
                background: '#0b0e1a',
                display: 'flex',
                alignItems: 'center',
                padding: '8px 14px 8px 79px',
                gap: 0,
                borderTop: `2px solid ${primaryColor}`,
              }}>
                {statItems.map((item, i) => (
                  <div key={item.label} style={{ textAlign: 'center', paddingRight: 14, paddingLeft: i === 0 ? 0 : 14, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1 }}>{item.value}</div>
                    <div style={{ color: '#7a7a9a', fontSize: 7, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: 0.2, width: '100%', maxWidth: 700 }}>
            <div style={{ height: 62, background: 'rgba(255,255,255,0.04)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, color: '#444', letterSpacing: 2, textTransform: 'uppercase' }}>Kein Spieler ausgewählt</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────
   Team Column
───────────────────────────────── */
function TeamColumn({ team, players, allPlayers, label, search, onSearch, filter, onFilter, activeId, onSelect, selectedId }: {
  team: Team | null; players: Player[]; allPlayers: Player[]; label: string
  search: string; onSearch: (v: string) => void; filter: string; onFilter: (v: string) => void
  activeId: string | null; onSelect: (p: Player) => void; selectedId: string | null
}) {
  const color = team?.primary_color ?? '#444'
  if (!team) {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden items-center justify-center" style={{ minHeight: 200 }}>
        <div className="text-[#333] text-xs font-bold tracking-widest uppercase">TBD</div>
        <div className="text-[#222] text-[11px] mt-1">Gegner noch nicht festgelegt</div>
      </div>
    )
  }
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Team header */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0" style={{ background: `${color}0d` }}>
        <div className="flex items-center gap-3 mb-3">
          {team.logo_url
            ? <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: color }}>
                <img src={team.logo_url} alt="" className="w-5 h-5 object-contain" />
              </div>
            : <div className="w-7 h-7 rounded flex items-center justify-center text-[9px] font-black text-white flex-shrink-0" style={{ background: color }}>{team.short_name.slice(0,2)}</div>
          }
          <div>
            <div className="text-[10px] font-bold tracking-widest text-[#555] uppercase">{label}</div>
            <div className="text-sm font-black leading-tight">{team.name}</div>
          </div>
          <div className="ml-auto text-[11px] text-[#444]">{allPlayers.length} Spieler</div>
        </div>

        {/* Search */}
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Suche…"
          className="w-full bg-[#131826] border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#444] outline-none mb-2" />

        {/* Position filter */}
        <div className="flex flex-wrap gap-1">
          {POSITIONS.map(pos => (
            <button key={pos} onClick={() => onFilter(pos)}
              className="px-2 py-0.5 rounded text-[10px] font-bold transition-all"
              style={{ background: filter === pos ? color : 'rgba(255,255,255,0.05)', color: filter === pos ? 'white' : '#666' }}>
              {pos}
            </button>
          ))}
        </div>
      </div>

      {/* Player card grid */}
      <div className="overflow-y-auto p-3 flex-1">
        {players.length === 0 ? (
          <div className="text-center text-[#333] text-xs py-8">Keine Spieler</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {players.map(p => {
              const isActive = p.id === activeId
              const isSelected = p.id === selectedId
              return (
                <button key={p.id} onClick={() => onSelect(p)}
                  style={{
                    background: isActive ? `${color}25` : isSelected ? 'rgba(255,255,255,0.08)' : '#171c2e',
                    border: `1px solid ${isActive ? color : isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 10,
                    padding: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    minHeight: 120,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}>
                  {/* Jersey # + position badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{
                      fontSize: 34, fontWeight: 900,
                      fontFamily: '"Arial Black", Impact, sans-serif',
                      color: isActive ? color : 'rgba(255,255,255,0.65)',
                      lineHeight: 1,
                    }}>
                      {p.jersey_number ?? '—'}
                    </span>
                    <span style={{
                      background: color,
                      color: 'white', fontSize: 8, fontWeight: 800,
                      padding: '3px 5px', borderRadius: 4,
                      letterSpacing: 0.3, lineHeight: 1.4,
                      maxWidth: 44, textAlign: 'center', wordBreak: 'break-all',
                    }}>
                      {p.positions.slice(0, 2).join('/')}
                    </span>
                  </div>

                  {/* Name + indicators */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'white', lineHeight: 1.2 }}>{p.first_name}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', lineHeight: 1.2 }}>{p.last_name}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      {p.is_active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#04a550', boxShadow: '0 0 4px #04a550' }} />}
                      {isActive && <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: 0.5, color: color }}>AIR</div>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────
   Player Detail Modal
───────────────────────────────── */
function PlayerModal({ player, team, careerStats, loadingStats, overlayActiveId, overlayVisible, overlayMode, onClose, onShow, onHide }: {
  player: Player; team: Team | null | undefined
  careerStats: any; loadingStats: boolean
  overlayActiveId: string | null; overlayVisible: boolean; overlayMode: 'live' | 'career'
  onClose: () => void
  onShow: (mode: 'live' | 'career') => void
  onHide: () => void
}) {
  const isOnAir = player.id === overlayActiveId
  const primaryColor = team?.primary_color ?? '#ff1d25'

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(2px)' }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 340,
        background: '#0c0f1a', borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 50, overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#0c0f1a', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: primaryColor, letterSpacing: 2, textTransform: 'uppercase' }}>
              {player.positions.join(' · ')}
            </span>
            <span style={{ color: '#333' }}>·</span>
            <span style={{ fontSize: 11, color: '#555' }}>#{player.jersey_number ?? '—'}</span>
            {team?.logo_url && (
              <><span style={{ color: '#333' }}>·</span>
              <div style={{ width: 20, height: 20, background: primaryColor, borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={team.logo_url} alt="" style={{ width: 14, height: 14, objectFit: 'contain' }} />
              </div></>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, width: 26, height: 26, color: '#888', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Name */}
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ fontSize: 30, fontWeight: 900, color: 'white', lineHeight: 1.1, letterSpacing: -0.5 }}>{player.first_name}</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: 'rgba(255,255,255,0.5)', lineHeight: 1.1, letterSpacing: -0.5 }}>{player.last_name}</div>

          {/* Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {player.is_active && <Chip color="#04a550">● Aktiv</Chip>}
            {player.field_of_study && <Chip>{player.field_of_study}</Chip>}
            {player.semester && <Chip>{player.semester}</Chip>}
          </div>
        </div>

        {/* ── Overlay controls ── */}
        {(() => {
          const boxBg     = isOnAir && overlayVisible  ? 'rgba(4,165,80,0.08)'
                          : isOnAir && !overlayVisible ? 'rgba(120,120,120,0.08)'
                          : `${primaryColor}0a`
          const boxBorder = isOnAir && overlayVisible  ? '#04a550'
                          : isOnAir && !overlayVisible ? 'rgba(180,180,180,0.25)'
                          : `${primaryColor}30`
          const tagColor  = isOnAir && overlayVisible  ? '#04a550' : '#666'
          const dotColor  = isOnAir && overlayVisible  ? '#04a550' : '#555'
          const dotGlow   = isOnAir && overlayVisible  ? '0 0 5px #04a550' : 'none'
          return (
        <div style={{ margin: '0 16px 16px', background: boxBg, border: `1px solid ${boxBorder}`, borderRadius: 10, padding: 12 }}>
          {isOnAir && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 11, color: tagColor, fontWeight: 700 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, boxShadow: dotGlow }} />
              AUF OVERLAY {overlayVisible ? '· SICHTBAR' : '· VERBORGEN'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Live Stats — red when active, hides on second click */}
            {(() => {
              const isLiveActive = isOnAir && overlayVisible && overlayMode === 'live'
              return (
                <button
                  onClick={() => isLiveActive ? onHide() : onShow('live')}
                  style={{
                    flex: 1, padding: '10px 8px', fontSize: 12, fontWeight: 800,
                    border: isLiveActive ? '1px solid #ff1d25' : 'none',
                    borderRadius: 8, cursor: 'pointer',
                    background: isLiveActive ? 'rgba(255,29,37,0.15)' : '#ff1d25',
                    color: isLiveActive ? '#ff1d25' : 'white',
                  }}
                >
                  {isLiveActive ? '▼ Live Stats ausblenden' : '▲ Live Stats einblenden'}
                </button>
              )
            })()}
            {/* Saisonwerte — highlighted when active, hides on second click */}
            {(() => {
              const isCareerActive = isOnAir && overlayVisible && overlayMode === 'career'
              return (
                <button
                  onClick={() => isCareerActive ? onHide() : onShow('career')}
                  style={{
                    flex: 1, padding: '10px 8px', fontSize: 12, fontWeight: 800,
                    border: `1px solid ${isCareerActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8, cursor: 'pointer',
                    background: isCareerActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
                    color: isCareerActive ? '#fff' : '#aaa',
                  }}
                >
                  {isCareerActive ? '▼ Ausblenden' : '📊 Saisonwerte'}
                </button>
              )
            })()}
          </div>
        </div>
          )
        })()}

        {/* ── Biografie ── */}
        <SectionHead title="Biografie" />
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'transparent' }}>
          {player.height_cm && <BioCell label="Größe" value={`${player.height_cm} cm`} />}
          {player.weight_kg && <BioCell label="Gewicht" value={`${player.weight_kg} kg`} />}
          {player.country && <BioCell label="Herkunft" value={player.country} />}
          {player.hometown && <BioCell label="Heimatort" value={player.hometown} />}
          {player.acsl_since && <BioCell label="ACSL seit" value={player.acsl_since} />}
          {player.semester && <BioCell label="Semester" value={player.semester} />}
          {player.field_of_study && <BioCell label="Studiengang" value={player.field_of_study} span />}
        </div>
        {player.football_experience && (
          <div style={{ padding: '0 16px 12px', fontSize: 12, color: '#666' }}>
            <span style={{ color: '#888', fontWeight: 600 }}>Erfahrung: </span>{player.football_experience}
          </div>
        )}
        {player.fun_fact && (
          <div style={{ margin: '0 16px 16px', background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${primaryColor}`, borderRadius: '0 6px 6px 0', padding: '8px 10px', fontSize: 11, color: '#666', fontStyle: 'italic' }}>
            „{player.fun_fact}"
          </div>
        )}

        {/* ── Karrieredaten ── */}
        <SectionHead title="Karrieredaten" />
        <div style={{ padding: '0 16px 20px' }}>
          {loadingStats ? (
            <div style={{ color: '#444', fontSize: 12 }}>Lade…</div>
          ) : careerStats ? (
            <CareerStats cs={careerStats} positions={player.positions} />
          ) : (
            <div style={{ color: '#444', fontSize: 12, fontStyle: 'italic' }}>Noch keine Statistiken eingetragen</div>
          )}
        </div>
      </div>
    </>
  )
}

/* ─── Small helpers ─── */
function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: color ? `${color}15` : 'rgba(255,255,255,0.06)', color: color ?? '#888', fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 20, border: `1px solid ${color ? `${color}25` : 'rgba(255,255,255,0.07)'}` }}>
      {children}
    </span>
  )
}

function SectionHead({ title }: { title: string }) {
  return (
    <div style={{ padding: '0 16px 8px', fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#444', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: 10 }}>
      {title}
    </div>
  )
}

function BioCell({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : 'auto', background: '#131826', padding: '8px 10px', marginBottom: 1 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#444', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>{value}</div>
    </div>
  )
}

/* ─────────────────────────────────
   Team Stats Overlay Control Panel
───────────────────────────────── */
function TeamStatsControl({ teamOverlay, selectedGame, onPush, saving, overlayUrl, copied, onCopy }: {
  teamOverlay: TeamOverlayState
  selectedGame: Game | null
  onPush: (patch: Partial<TeamOverlayState>) => void
  saving: boolean
  overlayUrl: string
  copied: boolean
  onCopy: () => void
}) {
  const homeTeam = selectedGame?.home_team
  const awayTeam = selectedGame?.away_team

  return (
    <div style={{
      background: '#080b14',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#444', textTransform: 'uppercase' }}>
          Team Stats Overlay
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
        {saving && <span style={{ fontSize: 10, color: '#444' }}>saving…</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: teamOverlay.visible ? '#04a550' : '#333',
            boxShadow: teamOverlay.visible ? '0 0 6px #04a550' : 'none',
            transition: 'all 0.3s',
          }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: teamOverlay.visible ? '#04a550' : '#444', textTransform: 'uppercase' }}>
            {teamOverlay.visible ? 'On Air' : 'Hidden'}
          </span>
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

        {/* Display team selector */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          {([
            { value: 'both', label: '⬛ Beide' },
            { value: 'home', label: homeTeam ? `🏠 ${homeTeam.short_name}` : '🏠 Home' },
            { value: 'away', label: awayTeam ? `✈️ ${awayTeam.short_name}` : '✈️ Away' },
          ] as const).map(opt => (
            <button
              key={opt.value}
              onClick={() => onPush({ display_team: opt.value })}
              style={{
                padding: '7px 14px',
                fontSize: 11,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: teamOverlay.display_team === opt.value ? '#ff1d25' : '#131826',
                color: teamOverlay.display_team === opt.value ? 'white' : '#666',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Show / Hide button */}
        <button
          onClick={() => onPush({ visible: !teamOverlay.visible, game_id: selectedGame?.id ?? teamOverlay.game_id })}
          style={{
            padding: '8px 20px',
            fontSize: 12,
            fontWeight: 900,
            borderRadius: 8,
            border: `1px solid ${teamOverlay.visible ? '#04a550' : 'rgba(255,255,255,0.1)'}`,
            background: teamOverlay.visible ? 'rgba(4,165,80,0.15)' : 'rgba(255,255,255,0.04)',
            color: teamOverlay.visible ? '#04a550' : '#888',
            cursor: 'pointer',
            boxShadow: teamOverlay.visible ? '0 0 12px rgba(4,165,80,0.2)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {teamOverlay.visible ? '▼ HIDE' : '▲ SHOW'}
        </button>

        {/* URL copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <code style={{ background: '#131826', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 5, padding: '5px 9px', fontSize: 10, color: '#666', whiteSpace: 'nowrap' }}>
            {overlayUrl || '…'}
          </code>
          <button
            onClick={onCopy}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
              background: copied ? '#04a550' : '#1a2040',
              color: copied ? 'white' : '#888',
              border: '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.2s',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* No game warning */}
      {!selectedGame && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#555', fontStyle: 'italic' }}>
          Wähle oben ein Spiel aus um Team Stats zu senden
        </div>
      )}
    </div>
  )
}

function CareerStats({ cs, positions }: { cs: any; positions: string[] }) {
  const items: { label: string; value: string | number }[] = []
  if (positions.includes('QB')) {
    items.push({ label: 'Pass YDS', value: cs.pass_yards ?? 0 }, { label: 'TDs', value: (cs.pass_tds ?? 0) + (cs.qb_rush_tds ?? 0) }, { label: 'INT', value: cs.interceptions_thrown ?? 0 }, { label: 'Comp/Att', value: `${cs.pass_completions ?? 0}/${cs.pass_attempts ?? 0}` }, { label: 'Rush YDS', value: cs.qb_rush_yards ?? 0 })
  } else if (positions.includes('RB')) {
    items.push({ label: 'Rush YDS', value: cs.rush_yards ?? 0 }, { label: 'TDs', value: cs.rush_tds ?? 0 }, { label: 'Carries', value: cs.rush_carries ?? 0 }, { label: 'Rec YDS', value: cs.rb_rec_yards ?? 0 })
  } else if (positions.some(p => ['WR', 'TE'].includes(p))) {
    items.push({ label: 'Rec YDS', value: cs.rec_yards ?? 0 }, { label: 'TDs', value: cs.rec_tds ?? 0 }, { label: 'Rec', value: cs.receptions ?? 0 }, { label: 'Targets', value: cs.rec_targets ?? 0 })
  } else if (positions.some(p => ['K', 'P'].includes(p))) {
    items.push({ label: 'FG', value: `${cs.fg_made ?? 0}/${cs.fg_attempts ?? 0}` }, { label: 'EP', value: `${cs.ep_made ?? 0}/${cs.ep_attempts ?? 0}` }, { label: 'Pts', value: (cs.fg_made ?? 0) * 3 + (cs.ep_made ?? 0) })
  } else {
    items.push({ label: 'Sacks', value: cs.sacks ?? 0 }, { label: 'INT', value: cs.def_interceptions ?? 0 })
  }
  return (
    <div>
      {cs.season && <div style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>Saison {cs.season} · {cs.games_played ?? 0} Spiele</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {items.map(item => (
          <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '8px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: '"Arial Black", sans-serif', color: 'white', lineHeight: 1 }}>{item.value}</div>
            <div style={{ fontSize: 8, color: '#555', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 }}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
