'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { buildLineupScreens, groupsForSide, STARTER_TARGETS, POSITION_ORDER, type LineupSide } from '@/lib/lineup'
import LineupBand from '@/components/LineupBand'
import LineupFullPanel from '@/components/LineupFullPanel'
import StreamControls from '@/components/StreamControls'
import StreamImagePanel from '@/components/StreamImagePanel'
import StreamPersonBand from '@/components/StreamPersonBand'

type AdminMode = 'game' | 'stream'

/* ─── Types ─── */
type Team = { id: string; name: string; short_name: string; slug: string; primary_color: string; secondary_color: string; logo_url: string | null }
type Player = { id: string; first_name: string; last_name: string; nickname: string | null; jersey_number: string | null; positions: string[]; team_id: string; is_active: boolean; height_cm: number | null; weight_kg: number | null; country: string | null; hometown: string | null; field_of_study: string | null; semester: string | null; acsl_since: string | null; fun_fact: string | null; football_experience: string | null }
type Game = { id: string; status: 'scheduled' | 'live' | 'final'; game_type: string; season: number; home_score: number | null; away_score: number | null; scheduled_at: string | null; home_team: Team; away_team: Team | null }
type OverlayState = { active_player_id: string | null; game_id: string | null; mode: 'live' | 'career' | 'intro'; visible: boolean }

const POSITIONS = ['Alle', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P']

type TeamOverlayState = { game_id: string | null; display_team: 'both' | 'home' | 'away'; visible: boolean }
type KeyPlayerOverlayState = { game_id: string | null; player_ids: string[]; rotation_seconds: number; visible: boolean }

const KEY_PLAYER_POSITIONS = ['QB', 'WR', 'TE', 'RB']
const MAX_KEY_PER_TEAM = 4

const SEASON = 2026
type LineupStyle = 'band' | 'full'
type LineupOverlayState = { team_id: string | null; side: LineupSide; rotation_seconds: number; visible: boolean; display_style: LineupStyle }
type TeamStarters = { offense: string[]; defense: string[] }
type SortMode = 'number' | 'starter'

/* Reliably hide a set of singleton overlay-state rows (id=1).
   NOTE: supabase-js queries are lazy — they only run when awaited, so these
   mutual-exclusion writes MUST be awaited (Promise.all), never fire-and-forget. */
async function hideOtherOverlays(supabase: ReturnType<typeof createClient>, tables: string[]) {
  const now = new Date().toISOString()
  await Promise.all(tables.map(t => supabase.from(t).update({ visible: false, updated_at: now }).eq('id', 1)))
}

export default function OverlayControlPage() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [homePlayers, setHomePlayers] = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([])
  const [overlay, setOverlay] = useState<OverlayState>({ active_player_id: null, game_id: null, mode: 'live', visible: false })
  const [teamOverlay, setTeamOverlay] = useState<TeamOverlayState>({ game_id: null, display_team: 'both', visible: false })
  const [keyPlayerOverlay, setKeyPlayerOverlay] = useState<KeyPlayerOverlayState>({ game_id: null, player_ids: [], rotation_seconds: 6, visible: false })
  const [lineupOverlay, setLineupOverlay] = useState<LineupOverlayState>({ team_id: null, side: 'offense', rotation_seconds: 8, visible: false, display_style: 'band' })
  const [startersByTeam, setStartersByTeam] = useState<Record<string, TeamStarters>>({})
  const [starterEditorOpen, setStarterEditorOpen] = useState(false)
  const [adminMode, setAdminMode] = useState<AdminMode>('game')

  // Remember the selected top-level mode across reloads
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('acsl-overlay-admin-mode') : null
    if (stored === 'stream' || stored === 'game') setAdminMode(stored)
  }, [])
  function switchMode(m: AdminMode) {
    setAdminMode(m)
    try { localStorage.setItem('acsl-overlay-admin-mode', m) } catch {}
  }
  const [sortHome, setSortHome] = useState<SortMode>('number')
  const [sortAway, setSortAway] = useState<SortMode>('number')
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
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingTeam, setSavingTeam] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [savingLineup, setSavingLineup] = useState(false)

  useEffect(() => {
    setOverlayUrl(`${window.location.origin}/overlay/all`)
  }, [])

  // Realtime sync: keep local state in sync if another admin operates the overlay
  useEffect(() => {
    const supabase = createClient()
    const ch = supabase.channel('admin-overlay-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'overlay_state' },
        ({ new: row }) => setOverlay(row as OverlayState))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'team_overlay_state' },
        ({ new: row }) => setTeamOverlay(row as TeamOverlayState))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'key_player_overlay_state' },
        ({ new: row }) => setKeyPlayerOverlay(row as KeyPlayerOverlayState))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lineup_overlay_state' },
        ({ new: row }) => setLineupOverlay(row as LineupOverlayState))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const [{ data: gs }, { data: os }, { data: tos }, { data: kps }, { data: los }] = await Promise.all([
        supabase.from('games').select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)').eq('season', 2026).order('scheduled_at', { ascending: false }),
        supabase.from('overlay_state').select('*').eq('id', 1).single(),
        supabase.from('team_overlay_state').select('*').eq('id', 1).single(),
        supabase.from('key_player_overlay_state').select('*').eq('id', 1).single(),
        supabase.from('lineup_overlay_state').select('*').eq('id', 1).single(),
      ])
      if (gs) setGames(gs as Game[])
      if (os) setOverlay(os as OverlayState)
      if (tos) setTeamOverlay(tos as TeamOverlayState)
      if (kps) setKeyPlayerOverlay(kps as KeyPlayerOverlayState)
      if (los) setLineupOverlay(los as LineupOverlayState)
      const list = (gs ?? []) as Game[]
      const auto = list.find(g => g.status === 'live') ?? (os?.game_id ? list.find(g => g.id === os.game_id) : null) ?? null
      if (auto) { setSelectedGame(auto); loadPlayers(auto) }
    }
    init()
  }, []) // eslint-disable-line

  async function loadPlayers(game: Game) {
    const supabase = createClient()
    const teamIds = [game.home_team.id, game.away_team?.id].filter(Boolean) as string[]
    const [{ data: players }, { data: gs }, { data: ts }] = await Promise.all([
      supabase.from('players').select('*').in('team_id', teamIds).eq('is_active', true).order('jersey_number', { nullsFirst: false }),
      supabase.from('game_stats').select('*').eq('game_id', game.id),
      supabase.from('team_starters').select('team_id, offense, defense').in('team_id', teamIds).eq('season', SEASON),
    ])
    if (players) {
      setHomePlayers((players as Player[]).filter(p => p.team_id === game.home_team.id))
      setAwayPlayers(game.away_team ? (players as Player[]).filter(p => p.team_id === game.away_team!.id) : [])
    }
    setGameStatsRows(gs ?? [])
    const map: Record<string, TeamStarters> = {}
    ;(ts ?? []).forEach((r: any) => { map[r.team_id] = { offense: r.offense ?? [], defense: r.defense ?? [] } })
    setStartersByTeam(map)
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
    // Mutually exclusive: hide other big graphics whenever player overlay becomes visible
    if (patch.visible === true) {
      setTeamOverlay(prev => ({ ...prev, visible: false }))
      setLineupOverlay(prev => ({ ...prev, visible: false }))
      await hideOtherOverlays(supabase, ['team_overlay_state', 'lineup_overlay_state', 'stream_overlay_state'])
    }
    const next = { ...overlay, ...patch }
    setOverlay(next)

    setSaving(true)
    await supabase.from('overlay_state').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
    setSaving(false)
  }, [overlay])

  const pushTeamOverlay = useCallback(async (patch: Partial<TeamOverlayState>) => {
    const supabase = createClient()
    // Mutually exclusive: hide other big graphics whenever team stats become visible
    if (patch.visible === true) {
      setOverlay(prev => ({ ...prev, visible: false }))
      setLineupOverlay(prev => ({ ...prev, visible: false }))
      setKeyPlayerOverlay(prev => ({ ...prev, visible: false }))
      await hideOtherOverlays(supabase, ['overlay_state', 'lineup_overlay_state', 'stream_overlay_state', 'key_player_overlay_state'])
    }
    setTeamOverlay(prev => ({ ...prev, ...patch }))
    setSavingTeam(true)
    await supabase.from('team_overlay_state').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
    setSavingTeam(false)
  }, [])

  const pushKeyPlayerOverlay = useCallback(async (patch: Partial<KeyPlayerOverlayState>) => {
    const supabase = createClient()
    if (patch.visible === true) {
      setTeamOverlay(prev => ({ ...prev, visible: false }))
      setLineupOverlay(prev => ({ ...prev, visible: false }))
      await hideOtherOverlays(supabase, ['team_overlay_state', 'lineup_overlay_state', 'stream_overlay_state'])
    }
    setKeyPlayerOverlay(prev => ({ ...prev, ...patch }))
    setSavingKey(true)
    await supabase.from('key_player_overlay_state').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
    setSavingKey(false)
  }, [])

  const pushLineupOverlay = useCallback(async (patch: Partial<LineupOverlayState>) => {
    const supabase = createClient()
    // Mutually exclusive: hide the other big graphics whenever the lineup becomes visible
    if (patch.visible === true) {
      setOverlay(prev => ({ ...prev, visible: false }))
      setTeamOverlay(prev => ({ ...prev, visible: false }))
      setKeyPlayerOverlay(prev => ({ ...prev, visible: false }))
      await hideOtherOverlays(supabase, ['overlay_state', 'team_overlay_state', 'stream_overlay_state', 'key_player_overlay_state'])
    }
    setLineupOverlay(prev => ({ ...prev, ...patch }))
    setSavingLineup(true)
    await supabase.from('lineup_overlay_state').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
    setSavingLineup(false)
  }, [])

  // Persist a team's starting lineup (reusable per season) and update local state
  const saveStarters = useCallback(async (teamId: string, next: TeamStarters) => {
    setStartersByTeam(prev => ({ ...prev, [teamId]: next }))
    const supabase = createClient()
    await supabase.from('team_starters').upsert(
      { team_id: teamId, season: SEASON, offense: next.offense, defense: next.defense, updated_at: new Date().toISOString() },
      { onConflict: 'team_id,season' },
    )
  }, [])

  async function handleGameChange(gameId: string) {
    const game = games.find(g => g.id === gameId)
    if (!game) return
    setSelectedGame(game); loadPlayers(game)
    if (overlay.active_player_id) pushOverlay({ game_id: gameId })
    pushTeamOverlay({ game_id: gameId })
    // Key player ticker follows the selected game; clear stale selection from another game
    pushKeyPlayerOverlay({ game_id: gameId, player_ids: [] })
    // Point the lineup overlay at this game's home team unless it already shows one of the two teams
    if (lineupOverlay.team_id !== game.home_team.id && lineupOverlay.team_id !== game.away_team?.id) {
      pushLineupOverlay({ team_id: game.home_team.id })
    }
  }

  async function showOnOverlay(player: Player, mode: 'live' | 'career' | 'intro') {
    // Mutually exclusive: hide team stats overlay whenever a player becomes visible
    void pushTeamOverlay({ visible: false })
    await pushOverlay({ active_player_id: player.id, game_id: selectedGame?.id ?? overlay.game_id, mode, visible: true })
  }

  function copyUrl() {
    navigator.clipboard.writeText(overlayUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
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

  const starterSet = (teamId?: string) => {
    const s = teamId ? startersByTeam[teamId] : undefined
    return new Set<string>([...(s?.offense ?? []), ...(s?.defense ?? [])])
  }
  const homeStarterIds = starterSet(selectedGame?.home_team.id)
  const awayStarterIds = starterSet(selectedGame?.away_team?.id)

  return (
    <div className="min-h-screen bg-[#0c0f1a] text-white" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ══ Top bar — mode switch + match selector ══ */}
      <div className="sticky top-0 z-20 bg-[#080b14] border-b border-white/5 px-5 py-3 flex flex-wrap items-center gap-4">
        <div>
          <div className="text-base font-black tracking-tight">vMix Overlay Control</div>
          <div className="text-[11px] text-[#555] mt-0.5">ACSL Media</div>
        </div>

        {/* Mode switch: live game broadcast vs stream graphics */}
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {([['game', 'Live Game Broadcast'], ['stream', 'Stream Einblendungen']] as const).map(([val, txt]) => (
            <button key={val} onClick={() => switchMode(val)}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all"
              style={{ background: adminMode === val ? '#ff1d25' : '#131826', color: adminMode === val ? 'white' : '#777' }}>
              {txt}
            </button>
          ))}
        </div>

        {/* Game selector (only in game mode) */}
        {adminMode === 'game' && (
          <select value={selectedGame?.id ?? ''} onChange={e => handleGameChange(e.target.value)}
            className="bg-[#131826] border border-white/8 rounded-lg px-3 py-2 text-white text-sm outline-none flex-1 min-w-[240px] max-w-lg">
            <option value="">Spiel auswählen…</option>
            {games.map(g => <option key={g.id} value={g.id}>{gameLabel(g)}</option>)}
          </select>
        )}

        {/* Single vMix link — same for all overlays */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#444', textTransform: 'uppercase' }}>vMix Input</span>
          <code style={{ background: '#131826', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 4, padding: '5px 8px', fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
            {overlayUrl || '…'}
          </code>
          <button onClick={copyUrl} style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: 4, background: copied ? '#04a550' : '#1a2040', color: copied ? 'white' : '#888', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      {/* ══ Operator Preview — always visible regardless of tab ══ */}
      <OperatorPreview
        player={activePlayer ?? null}
        team={activePlayer
          ? (homePlayers.find(p => p.id === activePlayer.id) ? selectedGame?.home_team ?? null : selectedGame?.away_team ?? null)
          : null}
        stats={previewStats}
        mode={overlay.mode}
        visible={overlay.visible}
        teamOverlay={teamOverlay}
        keyPlayerOverlay={keyPlayerOverlay}
        lineupOverlay={lineupOverlay}
        startersByTeam={startersByTeam}
        homeTeam={selectedGame?.home_team ?? null}
        awayTeam={selectedGame?.away_team ?? null}
        homePlayers={homePlayers}
        awayPlayers={awayPlayers}
        gameStatsRows={gameStatsRows}
      />

      {adminMode === 'stream' ? <StreamControls /> : (
      <>
      {/* ══ Team Stats Overlay Control ══ */}
      <TeamStatsControl
        teamOverlay={teamOverlay}
        selectedGame={selectedGame}
        onPush={pushTeamOverlay}
        saving={savingTeam}
      />

      {/* ══ Key Player Ticker Control ══ */}
      <KeyPlayerControl
        keyPlayerOverlay={keyPlayerOverlay}
        selectedGame={selectedGame}
        homePlayers={homePlayers}
        awayPlayers={awayPlayers}
        onPush={pushKeyPlayerOverlay}
        saving={savingKey}
      />

      {/* ══ Starting Lineup Control (band + full screen, one input) ══ */}
      <LineupControl
        lineupOverlay={lineupOverlay}
        selectedGame={selectedGame}
        startersByTeam={startersByTeam}
        onPush={pushLineupOverlay}
        onEdit={() => setStarterEditorOpen(true)}
        saving={savingLineup}
      />

      {/* ══ Player overlay (Lower Third) — controls ══ */}
      <div style={{ background: '#080b14', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#444', textTransform: 'uppercase' }}>
            Spieler-Einblendung · Lower Third
          </span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
          {saving && <span style={{ fontSize: 10, color: '#444' }}>saving…</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: overlay.visible ? '#04a550' : '#333', boxShadow: overlay.visible ? '0 0 6px #04a550' : 'none', transition: 'all 0.3s' }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: overlay.visible ? '#04a550' : '#444', textTransform: 'uppercase' }}>
              {overlay.visible ? 'On Air' : 'Hidden'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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

          <span style={{ fontSize: 11, color: '#555' }}>
            {selectedGame ? 'Klick auf eine Karte für Einblende-Optionen' : ''}
          </span>
        </div>
      </div>

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
            sort={sortHome}
            onSort={setSortHome}
            starterIds={homeStarterIds}
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
            sort={sortAway}
            onSort={setSortAway}
            starterIds={awayStarterIds}
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

      {/* ══ Starter editor (pre-game lineup selection) ══ */}
      {starterEditorOpen && selectedGame && (
        <StarterEditor
          teams={[selectedGame.home_team, selectedGame.away_team].filter(Boolean) as Team[]}
          playersByTeam={{
            [selectedGame.home_team.id]: homePlayers,
            ...(selectedGame.away_team ? { [selectedGame.away_team.id]: awayPlayers } : {}),
          }}
          startersByTeam={startersByTeam}
          onSave={saveStarters}
          onClose={() => setStarterEditorOpen(false)}
        />
      )}
      </>
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
  const primaryPos = positions[0] ?? ''
  const hasKP  = positions.some((p: string) => ['K', 'P'].includes(p))
  const hasDef = positions.some((p: string) => ['DB', 'LB', 'DL', 'OL'].includes(p))

  if (primaryPos === 'QB') {
    items.push(
      { label: 'PASS YDS', value: s.pass_yards ?? 0 },
      { label: 'TDs', value: (s.pass_tds ?? 0) + (s.qb_rush_tds ?? 0) },
      { label: 'INT', value: s.interceptions_thrown ?? 0 },
      { label: 'C/ATT', value: `${s.pass_completions ?? 0}/${s.pass_attempts ?? 0}` },
      { label: 'RUSH', value: s.qb_rush_yards ?? 0 },
    )
  } else if (primaryPos === 'RB') {
    items.push(
      { label: 'RUSH YDS', value: s.rush_yards ?? 0 },
      { label: 'TDs', value: s.rush_tds ?? 0 },
      { label: 'CAR', value: s.rush_carries ?? 0 },
      { label: 'REC YDS', value: s.rb_rec_yards ?? 0 },
      { label: 'REC', value: s.rb_receptions ?? 0 },
    )
  } else if (['WR', 'TE'].includes(primaryPos)) {
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

/* ─── Key player ticker stats (mirrors /overlay/key-players) ─── */
function buildKeyTickerStats(positions: string[], s: any): { label: string; value: string | number }[] {
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
    const yds = s.rush_yards ?? 0, car = s.rush_carries ?? 0
    return [
      { label: 'CAR', value: car },
      { label: 'RUSH YDS', value: yds },
      { label: 'YPC', value: car ? (yds / car).toFixed(1) : '0.0' },
    ]
  }
  return []
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
  let completions = 0, attempts = 0
  let fgm = 0, fga = 0, epm = 0, epa = 0
  players.forEach(p => {
    const rows = gsRows.filter(r => r.player_id === p.id)
    const qs: Record<string, number> = {}
    rows.forEach(r => Object.entries(r).forEach(([k, v]) => { if (typeof v === 'number') qs[k] = (qs[k] ?? 0) + v }))
    const pos = p.positions as string[]
    const primaryPos = pos[0] ?? ''
    if (primaryPos === 'QB') {
      passYds += qs.pass_yards ?? 0; rushYds += qs.qb_rush_yards ?? 0
      completions += qs.pass_completions ?? 0; attempts += qs.pass_attempts ?? 0
      tds += (qs.pass_tds ?? 0) + (qs.qb_rush_tds ?? 0); ints += qs.interceptions_thrown ?? 0
    } else if (primaryPos === 'RB') {
      rushYds += qs.rush_yards ?? 0; recYds += qs.rb_rec_yards ?? 0
      tds += qs.rush_tds ?? 0; fumbles += qs.rb_fumbles ?? 0
      targets += qs.rb_targets ?? 0; receptions += qs.rb_receptions ?? 0
    } else if (['WR', 'TE'].includes(primaryPos)) {
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
  return { passYds, rushYds, recYds, totalYds, tds, ints, fumbles, targets, receptions, catchPct, completions, attempts, fgm, fga, epm, epa }
}

function OperatorPreview({ player, team, stats, mode, visible,
  teamOverlay, keyPlayerOverlay, lineupOverlay, startersByTeam, homeTeam, awayTeam, homePlayers, awayPlayers, gameStatsRows }: {
  player: Player | null
  team: Team | null | undefined
  stats: any
  mode: 'live' | 'career' | 'intro'
  visible: boolean
  teamOverlay: TeamOverlayState
  keyPlayerOverlay: KeyPlayerOverlayState
  lineupOverlay: LineupOverlayState
  startersByTeam: Record<string, TeamStarters>
  homeTeam: Team | null | undefined
  awayTeam: Team | null | undefined
  homePlayers: Player[]
  awayPlayers: Player[]
  gameStatsRows: any[]
}) {
  const primaryColor   = team?.primary_color   ?? '#ff1d25'
  const onPrimary      = team ? textOn(primaryColor) : '#ffffff'
  const dimOnPrimary   = onPrimary === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.50)'
  const hairline       = onPrimary === '#ffffff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'
  const statItems      = player && mode !== 'intro' ? buildStatItems(player.positions, stats) : []
  const hasStats       = statItems.length > 0

  /* ── Key player ticker items (selection order, live-aggregated) ── */
  const tickerItems = (keyPlayerOverlay.player_ids ?? []).map(id => {
    const p = [...homePlayers, ...awayPlayers].find(x => x.id === id)
    if (!p) return null
    const isHome = homePlayers.some(x => x.id === id)
    const tTeam = isHome ? homeTeam ?? null : awayTeam ?? null
    const totals: Record<string, number> = {}
    gameStatsRows.filter(r => r.player_id === id).forEach(r =>
      Object.entries(r).forEach(([k, v]) => { if (typeof v === 'number') totals[k] = (totals[k] ?? 0) + v }))
    return { player: p, team: tTeam, stats: buildKeyTickerStats(p.positions, totals) }
  }).filter(Boolean) as { player: Player; team: Team | null; stats: { label: string; value: string | number }[] }[]

  const [tIdx, setTIdx] = useState(0)
  const [tShown, setTShown] = useState(true)
  useEffect(() => { setTIdx(0); setTShown(true) }, [tickerItems.length])
  useEffect(() => {
    if (tickerItems.length <= 1) return
    const ms = Math.max(2, keyPlayerOverlay.rotation_seconds ?? 6) * 1000
    const t = setInterval(() => { setTShown(false); setTimeout(() => { setTIdx(i => (i + 1) % tickerItems.length); setTShown(true) }, 380) }, ms)
    return () => clearInterval(t)
  }, [tickerItems.length, keyPlayerOverlay.rotation_seconds])
  const tCur = tickerItems[tIdx] ?? null

  /* ── Lineup band (selection-ordered, grouped into position screens) ── */
  const lineupTeam = lineupOverlay.team_id === homeTeam?.id ? homeTeam ?? null
                   : lineupOverlay.team_id === awayTeam?.id ? awayTeam ?? null : null
  const lineupRoster = lineupOverlay.team_id === homeTeam?.id ? homePlayers
                     : lineupOverlay.team_id === awayTeam?.id ? awayPlayers : []
  const lineupStarterIds = (lineupOverlay.team_id ? startersByTeam[lineupOverlay.team_id] : undefined)?.[lineupOverlay.side] ?? []
  const lineupPlayers = lineupStarterIds
    .map(id => lineupRoster.find(p => p.id === id))
    .filter(Boolean) as Player[]
  const lineupScreens = buildLineupScreens(lineupOverlay.side, lineupPlayers)

  const [lIdx, setLIdx] = useState(0)
  const [lShown, setLShown] = useState(true)
  useEffect(() => { setLIdx(0); setLShown(true) }, [lineupScreens.length, lineupOverlay.side, lineupOverlay.team_id])
  useEffect(() => {
    if (lineupScreens.length <= 1) return
    const ms = Math.max(3, lineupOverlay.rotation_seconds ?? 8) * 1000
    const t = setInterval(() => { setLShown(false); setTimeout(() => { setLIdx(i => (i + 1) % lineupScreens.length); setLShown(true) }, 400) }, ms)
    return () => clearInterval(t)
  }, [lineupScreens.length, lineupOverlay.rotation_seconds])

  /* ── Stream overlay state (subscribed internally so preview works in both tabs) ── */
  const [streamState, setStreamState] = useState<{ mode: 'image'|'person'; image_path: string|null; person_id: string|null; visible: boolean }>
    ({ mode: 'image', image_path: null, person_id: null, visible: false })
  const [streamPeople, setStreamPeople] = useState<{ id: string; name: string; role: string|null }[]>([])
  const [streamImageUrl, setStreamImageUrl] = useState<string|null>(null)

  useEffect(() => {
    const supabase = createClient()
    function applyStream(s: typeof streamState) {
      setStreamState(s)
      if (s.mode === 'image' && s.image_path)
        setStreamImageUrl(supabase.storage.from('stream-images').getPublicUrl(s.image_path).data.publicUrl)
      else
        setStreamImageUrl(null)
    }
    async function initStream() {
      const [{ data: ss }, { data: ppl }] = await Promise.all([
        supabase.from('stream_overlay_state').select('mode, image_path, person_id, visible').eq('id', 1).single(),
        supabase.from('stream_people').select('id, name, role').order('sort_order', { ascending: true }),
      ])
      if (ss) applyStream(ss as typeof streamState)
      if (ppl) setStreamPeople(ppl as typeof streamPeople)
    }
    initStream()
    const ch = supabase.channel('operator-preview-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_overlay_state' },
        ({ new: row }) => applyStream(row as typeof streamState))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const streamPerson = streamState.visible && streamState.mode === 'person'
    ? streamPeople.find(p => p.id === streamState.person_id) ?? null
    : null

  /* ── 16:9 broadcast stage (true 1920×1080, scaled to fit) ── */
  const STAGE_W = 760, W = 1920, H = 1080, SCALE = STAGE_W / W
  const STAGE_H = Math.round(H * SCALE)
  const anyOnAir = (visible && player && team) || teamOverlay.visible || (keyPlayerOverlay.visible && tCur)
    || (lineupOverlay.visible && lineupTeam && lineupPlayers.length > 0)
    || (streamState.visible && (streamImageUrl || streamPerson))

  return (
    <div style={{
      background: '#080b14',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 20px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#444', textTransform: 'uppercase' }}>
          Overlay Vorschau · wie im vMix-Fenster
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#444', letterSpacing: 1 }}>16:9 · 1920×1080</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: anyOnAir ? '#04a550' : '#333',
            boxShadow: anyOnAir ? '0 0 6px #04a550' : 'none',
            transition: 'all 0.3s',
          }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: anyOnAir ? '#04a550' : '#444', textTransform: 'uppercase' }}>
            {anyOnAir ? 'On Air' : 'Hidden'}
          </span>
        </div>
      </div>

      {/* 16:9 broadcast window */}
      <div style={{ width: STAGE_W, maxWidth: '100%', height: STAGE_H, borderRadius: 8, overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}>
        {/* faux video background so white overlays read like over live footage */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1d3a26 0%, #0c1c12 55%, #07120b 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(105deg, rgba(255,255,255,0.045) 0 2px, transparent 2px 64px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 70% at 50% 38%, rgba(255,255,255,0.06) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', top: 6, right: 9, fontSize: 8, fontWeight: 700, letterSpacing: 3, color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', zIndex: 5 }}>ACSL Broadcast</div>

        {!anyOnAir && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>
            Kein Overlay aktiv
          </div>
        )}

        {/* 1920×1080 stage — every overlay at its real broadcast coordinates */}
        <div style={{ width: W, height: H, transform: `scale(${SCALE})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>

          {/* ── TEAM STATS — fullscreen comparison ── */}
          {teamOverlay.visible && (homeTeam || awayTeam) && (() => {
            const hS = calcTeamTotals(homePlayers, gameStatsRows)
            const aS = calcTeamTotals(awayPlayers, gameStatsRows)
            const hC = homeTeam?.primary_color ?? '#1a1a2e'
            const aC = awayTeam?.primary_color ?? '#2e1a1a'
            const hT = textOn(hC), aT = textOn(aC)
            const HEADER_H = 150, LOGO_W = 360, N = 8
            const STAT_ROWS = [
              { label: 'PASS YDS',   h: hS.passYds,  a: aS.passYds  },
              { label: 'RUSH YDS',   h: hS.rushYds,  a: aS.rushYds  },
              { label: 'TOTAL YDS',  h: hS.totalYds, a: aS.totalYds },
              { label: 'COMP/ATT',   h: `${hS.completions}/${hS.attempts}`, a: `${aS.completions}/${aS.attempts}` },
              { label: 'TOTAL TDs',  h: hS.tds,      a: aS.tds,      accent: '#04a550' },
              { label: 'FIELD GOALS',h: hS.fgm,      a: aS.fgm      },
              { label: 'INT',        h: hS.ints,      a: aS.ints,     accent: '#ff1d25' },
              { label: 'FUMBLES',    h: hS.fumbles,   a: aS.fumbles,  accent: '#f59e0b' },
            ]
            return (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ height: HEADER_H, flexShrink: 0, background: '#06080f', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 22, paddingRight: 60 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', fontFamily: 'Arial', lineHeight: 1 }}>HOME</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 1, lineHeight: 1.15, marginTop: 4 }}>{homeTeam?.short_name?.toUpperCase() ?? '—'}</div>
                    </div>
                    <div style={{ fontSize: 92, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: -3, lineHeight: 1, textShadow: `0 0 40px ${hC}90` }}>{hS.tds * 6 + hS.fgm * 3 + hS.epm}</div>
                  </div>
                  <div style={{ width: 300, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 60, fontWeight: 900, letterSpacing: 2, color: 'rgba(255,255,255,0.12)', fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1, textTransform: 'uppercase' }}>TEAM</div>
                    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 7, color: 'rgba(255,255,255,0.22)', fontFamily: '"Arial Black", sans-serif', lineHeight: 1, textTransform: 'uppercase', marginTop: -4 }}>STATS</div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 22, paddingLeft: 60 }}>
                    <div style={{ fontSize: 92, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: -3, lineHeight: 1, textShadow: `0 0 40px ${aC}90` }}>{aS.tds * 6 + aS.fgm * 3 + aS.epm}</div>
                    <div>
                      <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', fontFamily: 'Arial', lineHeight: 1 }}>AWAY</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 1, lineHeight: 1.15, marginTop: 4 }}>{awayTeam?.short_name?.toUpperCase() ?? '—'}</div>
                    </div>
                  </div>
                </div>
                {/* Body */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  {/* Home panel */}
                  <div style={{ width: LOGO_W, flexShrink: 0, background: hC, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 45%, rgba(255,255,255,0.1) 0%, transparent 70%)` }} />
                    {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 270, height: 270, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.45))' }} />}
                    <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 16px' }}>
                      <div style={{ fontSize: 38, fontWeight: 900, color: hT, fontFamily: '"Arial Black"', textTransform: 'uppercase', letterSpacing: 1 }}>{homeTeam?.short_name}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: hT === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', letterSpacing: 3, marginTop: 6, textTransform: 'uppercase', fontFamily: 'Arial' }}>{homeTeam?.name}</div>
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
                        <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', background: i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent', borderBottom: i < N - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', padding: '0 14px', position: 'relative' }}>
                          <div style={{ flex: 1, textAlign: 'right', paddingRight: 44 }}>
                            <span style={{ fontSize: hW ? 58 : 48, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', color: hW ? hi : 'rgba(255,255,255,0.55)', lineHeight: 1 }}>{h}</span>
                          </div>
                          <div style={{ width: 200, textAlign: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', fontFamily: '"Arial Black"' }}>{label}</span>
                          </div>
                          <div style={{ flex: 1, textAlign: 'left', paddingLeft: 44 }}>
                            <span style={{ fontSize: aW ? 58 : 48, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', color: aW ? hi : 'rgba(255,255,255,0.55)', lineHeight: 1 }}>{a}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {/* Away panel */}
                  <div style={{ width: LOGO_W, flexShrink: 0, background: aC, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 45%, rgba(255,255,255,0.1) 0%, transparent 70%)` }} />
                    {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 270, height: 270, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 24px rgba(0,0,0,0.45))' }} />}
                    <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 16px' }}>
                      <div style={{ fontSize: 38, fontWeight: 900, color: aT, fontFamily: '"Arial Black"', textTransform: 'uppercase', letterSpacing: 1 }}>{awayTeam?.short_name}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: aT === '#ffffff' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', letterSpacing: 3, marginTop: 6, textTransform: 'uppercase', fontFamily: 'Arial' }}>{awayTeam?.name}</div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── LOWER THIRD — bottom-left (real overlay sizes) ── */}
          {visible && player && team && (
            <div style={{ position: 'absolute', bottom: 56, left: 72, display: 'inline-flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.85)' }}>
              {/* Nameplate */}
              <div style={{ display: 'flex', alignItems: 'stretch', background: primaryColor, height: 80 }}>
                <div style={{ width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 10 }}>
                  {team.logo_url
                    ? <img src={team.logo_url} alt="" style={{ width: 66, height: 66, objectFit: 'contain' }} />
                    : <div style={{ width: 66, height: 66, borderRadius: 4, background: hairline }} />}
                </div>
                <div style={{ width: 1, background: hairline, margin: '12px 0', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 22px', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, lineHeight: 1 }}>
                    {player.jersey_number != null && (
                      <span style={{ color: dimOnPrimary, fontSize: 18, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.5 }}>#{player.jersey_number}</span>
                    )}
                    <span style={{ color: onPrimary, fontSize: 26, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                      {player.first_name.toUpperCase()} {player.last_name.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, lineHeight: 1 }}>
                    <span style={{ color: onPrimary, fontSize: 11, fontWeight: 900, letterSpacing: 2.5, textTransform: 'uppercase', background: hairline, padding: '3px 7px', borderRadius: 2 }}>
                      {player.positions.join(' · ')}
                    </span>
                    <span style={{ color: hairline, fontSize: 12 }}>·</span>
                    <span style={{ color: dimOnPrimary, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>{team.short_name}</span>
                  </div>
                </div>
              </div>
              {/* Stats bar */}
              {hasStats && (
                <div style={{ background: '#0b0e1a', display: 'flex', alignItems: 'center', padding: '10px 22px 10px 102px', borderTop: `2px solid ${primaryColor}` }}>
                  {statItems.map((item, i) => (
                    <div key={item.label} style={{ textAlign: 'center', paddingRight: 20, paddingLeft: i === 0 ? 0 : 20, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                      <div style={{ color: '#fff', fontSize: 22, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1, letterSpacing: -0.5 }}>{item.value}</div>
                      <div style={{ color: '#7a7a9a', fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── KEY PLAYER TICKER — bottom-right (real overlay sizes) ── */}
          {keyPlayerOverlay.visible && tCur && (
            <div style={{ position: 'absolute', bottom: 64, right: 72, textAlign: 'right', transition: 'opacity 0.34s ease', opacity: tShown ? 1 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 12, lineHeight: 1, textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.8)' }}>
                {tCur.player.jersey_number != null && (
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 22, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif' }}>#{tCur.player.jersey_number}</span>
                )}
                <span style={{ color: '#fff', fontSize: 34, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                  {tCur.player.first_name.charAt(0).toUpperCase()}. {tCur.player.last_name.toUpperCase()}
                </span>
              </div>
              <div style={{ marginTop: 6, lineHeight: 1, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}>
                {tCur.team?.short_name ?? ''} · {tCur.player.positions[0] ?? ''}
              </div>
              {tCur.stats.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 26, textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.8)' }}>
                  {tCur.stats.map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                      <span style={{ color: '#fff', fontSize: 30, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1, letterSpacing: -0.5 }}>{item.value}</span>
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STARTING LINEUP — band or full screen (display_style) ── */}
          <LineupBand
            team={lineupTeam}
            side={lineupOverlay.side}
            screens={lineupScreens}
            idx={lIdx}
            shown={lShown}
            visible={lineupOverlay.visible && lineupOverlay.display_style === 'band'}
          />
          <LineupFullPanel
            team={lineupTeam}
            side={lineupOverlay.side}
            players={lineupPlayers}
            visible={lineupOverlay.visible && lineupOverlay.display_style === 'full'}
          />

          {/* ── STREAM — image panel or person band ── */}
          <StreamImagePanel url={streamImageUrl} visible={streamState.visible && streamState.mode === 'image'} />
          <StreamPersonBand person={streamPerson} visible={streamState.visible && streamState.mode === 'person'} />
        </div>

        {/* Ticker rotation dots */}
        {keyPlayerOverlay.visible && tickerItems.length > 1 && (
          <div style={{ position: 'absolute', bottom: 6, right: 8, display: 'flex', gap: 4, zIndex: 5 }}>
            {tickerItems.map((_, i) => (
              <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i === tIdx ? '#fff' : 'rgba(255,255,255,0.3)' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────
   Team Column
───────────────────────────────── */
function TeamColumn({ team, players, allPlayers, label, search, onSearch, filter, onFilter, sort, onSort, starterIds, activeId, onSelect, selectedId }: {
  team: Team | null; players: Player[]; allPlayers: Player[]; label: string
  search: string; onSearch: (v: string) => void; filter: string; onFilter: (v: string) => void
  sort: SortMode; onSort: (v: SortMode) => void; starterIds: Set<string>
  activeId: string | null; onSelect: (p: Player) => void; selectedId: string | null
}) {
  const color = team?.primary_color ?? '#444'
  // 'starter' sort: starters first (preserving the incoming jersey order), then the rest
  const sortedPlayers = sort === 'starter'
    ? [...players.filter(p => starterIds.has(p.id)), ...players.filter(p => !starterIds.has(p.id))]
    : players
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

        {/* Sort toggle: by jersey number (default) or starters first */}
        <div className="flex items-center gap-2 mt-2">
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#555', textTransform: 'uppercase' }}>Sortierung</span>
          <div className="flex rounded-md overflow-hidden border border-white/8">
            {([['number', 'Nummer'], ['starter', '★ Starter']] as const).map(([val, txt]) => (
              <button key={val} onClick={() => onSort(val)}
                className="px-2.5 py-0.5 text-[10px] font-bold transition-all"
                style={{ background: sort === val ? color : '#131826', color: sort === val ? textOn(color) : '#666' }}>
                {txt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Player card grid */}
      <div className="overflow-y-auto p-3 flex-1">
        {sortedPlayers.length === 0 ? (
          <div className="text-center text-[#333] text-xs py-8">Keine Spieler</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {sortedPlayers.map(p => {
              const isActive = p.id === activeId
              const isSelected = p.id === selectedId
              const isStarter = starterIds.has(p.id)
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
                      {isStarter && <div title="Starter" style={{ fontSize: 11, color: '#f5b50a', lineHeight: 1 }}>★</div>}
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
  overlayActiveId: string | null; overlayVisible: boolean; overlayMode: 'live' | 'career' | 'intro'
  onClose: () => void
  onShow: (mode: 'live' | 'career' | 'intro') => void
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

          {/* Nur Karte — nameplate only, no stats bar */}
          {(() => {
            const isIntroActive = isOnAir && overlayVisible && overlayMode === 'intro'
            return (
              <button
                onClick={() => isIntroActive ? onHide() : onShow('intro')}
                style={{
                  width: '100%', marginTop: 8, padding: '9px 8px', fontSize: 12, fontWeight: 800,
                  border: `1px solid ${isIntroActive ? primaryColor : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, cursor: 'pointer',
                  background: isIntroActive ? `${primaryColor}22` : 'rgba(255,255,255,0.03)',
                  color: isIntroActive ? primaryColor : '#888',
                }}
              >
                {isIntroActive ? '▼ Ausblenden' : '👤 Nur Karte einblenden'}
              </button>
            )
          })()}
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
function TeamStatsControl({ teamOverlay, selectedGame, onPush, saving }: {
  teamOverlay: TeamOverlayState
  selectedGame: Game | null
  onPush: (patch: Partial<TeamOverlayState>) => void
  saving: boolean
}) {
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

/* ─────────────────────────────────
   Key Player Ticker Control Panel
───────────────────────────────── */
function KeyPlayerControl({ keyPlayerOverlay, selectedGame, homePlayers, awayPlayers, onPush, saving }: {
  keyPlayerOverlay: KeyPlayerOverlayState
  selectedGame: Game | null
  homePlayers: Player[]
  awayPlayers: Player[]
  onPush: (patch: Partial<KeyPlayerOverlayState>) => void
  saving: boolean
}) {
  const selected = keyPlayerOverlay.player_ids ?? []
  const [pickerOpen, setPickerOpen] = useState(false)
  const eligible = (players: Player[]) => players.filter(p => KEY_PLAYER_POSITIONS.includes(p.positions[0] ?? ''))

  function toggle(player: Player, teamPlayers: Player[]) {
    const isSel = selected.includes(player.id)
    if (isSel) {
      onPush({ player_ids: selected.filter(id => id !== player.id) })
      return
    }
    const teamSelectedCount = teamPlayers.filter(p => selected.includes(p.id)).length
    if (teamSelectedCount >= MAX_KEY_PER_TEAM) return // enforce max per team
    onPush({ player_ids: [...selected, player.id] })
  }

  const homeEligible = eligible(homePlayers)
  const awayEligible = eligible(awayPlayers)
  const homeSelCount = homePlayers.filter(p => selected.includes(p.id)).length
  const awaySelCount = awayPlayers.filter(p => selected.includes(p.id)).length

  // Selected players in order, with their team colour (for the compact chips)
  const selectedChips = selected.map(id => {
    const p = [...homePlayers, ...awayPlayers].find(x => x.id === id)
    if (!p) return null
    const isHome = homePlayers.some(x => x.id === id)
    const color = (isHome ? selectedGame?.home_team : selectedGame?.away_team)?.primary_color ?? '#888'
    return { p, color }
  }).filter(Boolean) as { p: Player; color: string }[]

  return (
    <div style={{ background: '#080b14', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#444', textTransform: 'uppercase' }}>
          Key Player Ticker · permanent
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
        {saving && <span style={{ fontSize: 10, color: '#444' }}>saving…</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: keyPlayerOverlay.visible ? '#04a550' : '#333', boxShadow: keyPlayerOverlay.visible ? '0 0 6px #04a550' : 'none', transition: 'all 0.3s' }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: keyPlayerOverlay.visible ? '#04a550' : '#444', textTransform: 'uppercase' }}>
            {keyPlayerOverlay.visible ? 'On Air' : 'Hidden'}
          </span>
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          onClick={() => onPush({ visible: !keyPlayerOverlay.visible, game_id: selectedGame?.id ?? keyPlayerOverlay.game_id })}
          style={{
            padding: '8px 20px', fontSize: 12, fontWeight: 900, borderRadius: 8,
            border: `1px solid ${keyPlayerOverlay.visible ? '#04a550' : 'rgba(255,255,255,0.1)'}`,
            background: keyPlayerOverlay.visible ? 'rgba(4,165,80,0.15)' : 'rgba(255,255,255,0.04)',
            color: keyPlayerOverlay.visible ? '#04a550' : '#888', cursor: 'pointer',
            boxShadow: keyPlayerOverlay.visible ? '0 0 12px rgba(4,165,80,0.2)' : 'none', transition: 'all 0.2s',
          }}
        >
          {keyPlayerOverlay.visible ? '▼ HIDE' : '▲ SHOW'}
        </button>

        {/* Rotation speed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Wechsel</span>
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            {[4, 6, 8, 10].map(sec => (
              <button key={sec} onClick={() => onPush({ rotation_seconds: sec })}
                style={{ padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: 'none',
                  background: keyPlayerOverlay.rotation_seconds === sec ? '#ff1d25' : '#131826',
                  color: keyPlayerOverlay.rotation_seconds === sec ? 'white' : '#666' }}>
                {sec}s
              </button>
            ))}
          </div>
        </div>

        <span style={{ fontSize: 11, color: '#555' }}>{selected.length} ausgewählt</span>
      </div>

      {/* Player selection — compact: button opens popup, selection shown as chips */}
      {!selectedGame ? (
        <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>
          Wähle oben ein Spiel aus um Key Player auszuwählen
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setPickerOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer', background: '#1a2040', color: '#ccc', border: '1px solid rgba(255,255,255,0.12)' }}>
            ＋ Spieler auswählen
          </button>
          {selectedChips.length === 0 && (
            <span style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>Noch keine Key Player ausgewählt</span>
          )}
          {selectedChips.map(({ p, color }) => (
            <button key={p.id} onClick={() => onPush({ player_ids: selected.filter(id => id !== p.id) })}
              title="Entfernen"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 8, cursor: 'pointer', background: `${color}22`, border: `1px solid ${color}`, color: '#fff', fontSize: 12, fontWeight: 600 }}>
              <span style={{ fontWeight: 900, fontFamily: '"Arial Black", sans-serif', color: '#fff' }}>{p.jersey_number ?? '—'}</span>
              <span>{p.first_name.charAt(0)}. {p.last_name}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginLeft: 2 }}>×</span>
            </button>
          ))}
        </div>
      )}

      {/* Player picker popup */}
      {pickerOpen && selectedGame && (
        <>
          <div onClick={() => setPickerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(880px, 92vw)', maxHeight: '82vh', overflowY: 'auto', background: '#0c0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, zIndex: 61, boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>
            <div style={{ position: 'sticky', top: 0, background: '#0c0f1a', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>Key Player auswählen</span>
              <span style={{ fontSize: 11, color: '#666' }}>max. {MAX_KEY_PER_TEAM} pro Team · nur QB/WR/TE/RB</span>
              <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>{selected.length} ausgewählt</span>
              <button onClick={() => setPickerOpen(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, width: 28, height: 28, color: '#aaa', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <KeyPlayerColumn label="HOME" team={selectedGame.home_team} players={homeEligible} selected={selected}
                count={homeSelCount} onToggle={p => toggle(p, homePlayers)} />
              <KeyPlayerColumn label="AWAY" team={selectedGame.away_team} players={awayEligible} selected={selected}
                count={awaySelCount} onToggle={p => toggle(p, awayPlayers)} />
            </div>
            <div style={{ position: 'sticky', bottom: 0, background: '#0c0f1a', padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setPickerOpen(false)} style={{ padding: '8px 22px', fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer', background: '#1a2040', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}>
                Fertig
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KeyPlayerColumn({ label, team, players, selected, count, onToggle }: {
  label: string; team: Team | null; players: Player[]; selected: string[]
  count: number; onToggle: (p: Player) => void
}) {
  const color = team?.primary_color ?? '#444'
  const full = count >= MAX_KEY_PER_TEAM
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#888', textTransform: 'uppercase' }}>
          {label} · {team?.short_name ?? '—'}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: full ? '#ff1d25' : '#555', marginLeft: 'auto' }}>
          {count}/{MAX_KEY_PER_TEAM}
        </span>
      </div>
      {players.length === 0 ? (
        <div style={{ fontSize: 11, color: '#444', fontStyle: 'italic' }}>Keine QB/WR/TE/RB</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {players.map(p => {
            const isSel = selected.includes(p.id)
            const order = isSel ? selected.indexOf(p.id) + 1 : null
            const disabled = !isSel && full
            return (
              <button key={p.id} onClick={() => onToggle(p)} disabled={disabled}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8,
                  border: `1px solid ${isSel ? color : 'rgba(255,255,255,0.08)'}`,
                  background: isSel ? `${color}22` : disabled ? 'rgba(255,255,255,0.015)' : '#131826',
                  color: isSel ? '#fff' : disabled ? '#444' : '#aaa',
                  cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600,
                  opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
                }}>
                {order != null && (
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: color, color: textOn(color), fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{order}</span>
                )}
                <span style={{ color: isSel ? '#fff' : '#666', fontWeight: 900, fontFamily: '"Arial Black", sans-serif' }}>{p.jersey_number ?? '—'}</span>
                <span>{p.first_name.charAt(0)}. {p.last_name}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: isSel ? color : '#555', letterSpacing: 0.5 }}>{p.positions[0]}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CareerStats({ cs, positions }: { cs: any; positions: string[] }) {
  const items: { label: string; value: string | number }[] = []
  const primaryPos = positions[0] ?? ''
  const hasKP = positions.some(p => ['K', 'P'].includes(p))
  if (primaryPos === 'QB') {
    items.push({ label: 'Pass YDS', value: cs.pass_yards ?? 0 }, { label: 'TDs', value: (cs.pass_tds ?? 0) + (cs.qb_rush_tds ?? 0) }, { label: 'INT', value: cs.interceptions_thrown ?? 0 }, { label: 'Comp/Att', value: `${cs.pass_completions ?? 0}/${cs.pass_attempts ?? 0}` }, { label: 'Rush YDS', value: cs.qb_rush_yards ?? 0 })
  } else if (primaryPos === 'RB') {
    items.push({ label: 'Rush YDS', value: cs.rush_yards ?? 0 }, { label: 'TDs', value: cs.rush_tds ?? 0 }, { label: 'Carries', value: cs.rush_carries ?? 0 }, { label: 'Rec YDS', value: cs.rb_rec_yards ?? 0 })
  } else if (['WR', 'TE'].includes(primaryPos)) {
    items.push({ label: 'Rec YDS', value: cs.rec_yards ?? 0 }, { label: 'TDs', value: cs.rec_tds ?? 0 }, { label: 'Rec', value: cs.receptions ?? 0 }, { label: 'Targets', value: cs.rec_targets ?? 0 })
  } else if (!hasKP) {
    items.push({ label: 'Sacks', value: cs.sacks ?? 0 }, { label: 'INT', value: cs.def_interceptions ?? 0 })
  }
  if (hasKP) {
    items.push({ label: 'FG', value: `${cs.fg_made ?? 0}/${cs.fg_attempts ?? 0}` }, { label: 'EP', value: `${cs.ep_made ?? 0}/${cs.ep_attempts ?? 0}` }, { label: 'Pts', value: (cs.fg_made ?? 0) * 3 + (cs.ep_made ?? 0) })
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

/* ─────────────────────────────────
   Starting Lineup Control Panel
───────────────────────────────── */
function LineupControl({ lineupOverlay, selectedGame, startersByTeam, onPush, onEdit, saving }: {
  lineupOverlay: LineupOverlayState
  selectedGame: Game | null
  startersByTeam: Record<string, TeamStarters>
  onPush: (patch: Partial<LineupOverlayState>) => void
  onEdit: () => void
  saving: boolean
}) {
  const home = selectedGame?.home_team ?? null
  const away = selectedGame?.away_team ?? null
  const teamOptions = [home, away].filter(Boolean) as Team[]
  const activeTeamId = lineupOverlay.team_id ?? home?.id ?? null
  const activeTeam = teamOptions.find(t => t.id === activeTeamId) ?? null
  const starters = activeTeamId ? startersByTeam[activeTeamId] : undefined
  const sideCount = (starters?.[lineupOverlay.side] ?? []).length

  return (
    <div style={{ background: '#080b14', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#444', textTransform: 'uppercase' }}>
          Starting Lineup · Aufstellung
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)' }} />
        {saving && <span style={{ fontSize: 10, color: '#444' }}>saving…</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: lineupOverlay.visible ? '#04a550' : '#333', boxShadow: lineupOverlay.visible ? '0 0 6px #04a550' : 'none', transition: 'all 0.3s' }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: lineupOverlay.visible ? '#04a550' : '#444', textTransform: 'uppercase' }}>
            {lineupOverlay.visible ? 'On Air' : 'Hidden'}
          </span>
        </div>
      </div>

      {!selectedGame ? (
        <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>Wähle oben ein Spiel aus um die Aufstellung zu senden</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Show / Hide */}
          <button
            onClick={() => onPush({ visible: !lineupOverlay.visible, team_id: activeTeamId })}
            disabled={sideCount === 0}
            style={{
              padding: '8px 20px', fontSize: 12, fontWeight: 900, borderRadius: 8,
              border: `1px solid ${lineupOverlay.visible ? '#04a550' : 'rgba(255,255,255,0.1)'}`,
              background: lineupOverlay.visible ? 'rgba(4,165,80,0.15)' : 'rgba(255,255,255,0.04)',
              color: lineupOverlay.visible ? '#04a550' : sideCount === 0 ? '#444' : '#888',
              cursor: sideCount === 0 ? 'not-allowed' : 'pointer', opacity: sideCount === 0 ? 0.5 : 1,
              boxShadow: lineupOverlay.visible ? '0 0 12px rgba(4,165,80,0.2)' : 'none', transition: 'all 0.2s',
            }}>
            {lineupOverlay.visible ? '▼ HIDE' : '▲ SHOW'}
          </button>

          {/* Team selector */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            {teamOptions.map(t => {
              const isActive = t.id === activeTeamId
              return (
                <button key={t.id} onClick={() => onPush({ team_id: t.id })}
                  style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none',
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: isActive ? t.primary_color : '#131826', color: isActive ? textOn(t.primary_color) : '#666' }}>
                  {t.logo_url && <img src={t.logo_url} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />}
                  {t.short_name}
                </button>
              )
            })}
          </div>

          {/* Side selector */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            {(['offense', 'defense'] as const).map(s => (
              <button key={s} onClick={() => onPush({ side: s })}
                style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none', textTransform: 'uppercase', letterSpacing: 1,
                  background: lineupOverlay.side === s ? '#ff1d25' : '#131826', color: lineupOverlay.side === s ? 'white' : '#666' }}>
                {s === 'offense' ? 'Offense' : 'Defense'}
              </button>
            ))}
          </div>

          {/* Style selector: rotating band vs full screen */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            {([['band', 'Band'], ['full', 'Vollbild']] as const).map(([val, txt]) => (
              <button key={val} onClick={() => onPush({ display_style: val })}
                style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none', letterSpacing: 0.5,
                  background: lineupOverlay.display_style === val ? '#2b6cff' : '#131826', color: lineupOverlay.display_style === val ? 'white' : '#666' }}>
                {txt}
              </button>
            ))}
          </div>

          {/* Rotation speed (band only) */}
          {lineupOverlay.display_style === 'band' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Wechsel</span>
              <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                {[6, 8, 10, 12].map(sec => (
                  <button key={sec} onClick={() => onPush({ rotation_seconds: sec })}
                    style={{ padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: 'none',
                      background: lineupOverlay.rotation_seconds === sec ? '#ff1d25' : '#131826', color: lineupOverlay.rotation_seconds === sec ? 'white' : '#666' }}>
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Edit starters */}
          <button onClick={onEdit}
            style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer', background: '#1a2040', color: '#ccc', border: '1px solid rgba(255,255,255,0.12)' }}>
            ✎ Starter bearbeiten
          </button>

          <span style={{ fontSize: 11, color: sideCount === 0 ? '#ff1d25' : '#555' }}>
            {activeTeam?.short_name ?? '—'} · {lineupOverlay.side === 'offense' ? 'Offense' : 'Defense'}: {sideCount} Starter
          </span>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────
   Starter Editor — pick the reusable starting
   lineup (offense + defense) for each team.
───────────────────────────────── */
function StarterEditor({ teams, playersByTeam, startersByTeam, onSave, onClose }: {
  teams: Team[]
  playersByTeam: Record<string, Player[]>
  startersByTeam: Record<string, TeamStarters>
  onSave: (teamId: string, next: TeamStarters) => void
  onClose: () => void
}) {
  const [activeTeamId, setActiveTeamId] = useState(teams[0]?.id ?? '')
  const activeTeam = teams.find(t => t.id === activeTeamId) ?? null
  const roster = playersByTeam[activeTeamId] ?? []
  const current: TeamStarters = startersByTeam[activeTeamId] ?? { offense: [], defense: [] }
  const color = activeTeam?.primary_color ?? '#444'

  function toggle(side: LineupSide, playerId: string) {
    const list = current[side]
    const next = list.includes(playerId) ? list.filter(id => id !== playerId) : [...list, playerId]
    onSave(activeTeamId, { ...current, [side]: next })
  }

  // Auto-fill a side from the roster using STARTER_TARGETS (by primary position, ordered by jersey)
  function autoFill(side: LineupSide) {
    const targets = STARTER_TARGETS[side]
    const byPos: Record<string, Player[]> = {}
    roster.forEach(p => {
      const pos = p.positions[0] ?? ''
      if (targets[pos] != null) (byPos[pos] ??= []).push(p)
    })
    const ids: string[] = []
    Object.keys(targets)
      .sort((a, b) => (POSITION_ORDER[a] ?? 99) - (POSITION_ORDER[b] ?? 99))
      .forEach(pos => {
        const sorted = (byPos[pos] ?? []).slice().sort((a, b) => Number(a.jersey_number ?? 999) - Number(b.jersey_number ?? 999))
        sorted.slice(0, targets[pos]).forEach(p => ids.push(p.id))
      })
    onSave(activeTeamId, { ...current, [side]: ids })
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(960px, 94vw)', maxHeight: '86vh', overflowY: 'auto', background: '#0c0f1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, zIndex: 61, boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, background: '#0c0f1a', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>Starter bearbeiten</span>
          <span style={{ fontSize: 11, color: '#666' }}>gilt für alle Spiele der Saison · Reihenfolge = Anzeige-Reihenfolge</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, width: 28, height: 28, color: '#aaa', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Team tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px 0' }}>
          {teams.map(t => {
            const isActive = t.id === activeTeamId
            return (
              <button key={t.id} onClick={() => setActiveTeamId(t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${isActive ? t.primary_color : 'rgba(255,255,255,0.1)'}`,
                  background: isActive ? `${t.primary_color}22` : '#131826', color: isActive ? '#fff' : '#777' }}>
                {t.logo_url && <img src={t.logo_url} alt="" style={{ width: 18, height: 18, objectFit: 'contain' }} />}
                {t.name}
              </button>
            )
          })}
        </div>

        {/* Two sides */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 18 }}>
          {(['offense', 'defense'] as const).map(side => (
            <StarterSidePanel key={side} side={side} roster={roster} selected={current[side]} color={color}
              onToggle={pid => toggle(side, pid)} onAutoFill={() => autoFill(side)} />
          ))}
        </div>

        <div style={{ position: 'sticky', bottom: 0, background: '#0c0f1a', padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: '#555' }}>Änderungen werden automatisch gespeichert.</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', padding: '8px 22px', fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer', background: '#1a2040', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' }}>
            Fertig
          </button>
        </div>
      </div>
    </>
  )
}

function StarterSidePanel({ side, roster, selected, color, onToggle, onAutoFill }: {
  side: LineupSide; roster: Player[]; selected: string[]; color: string
  onToggle: (playerId: string) => void; onAutoFill: () => void
}) {
  const groups = groupsForSide(side)
  const total = Object.values(STARTER_TARGETS[side]).reduce((a, b) => a + b, 0)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>
          {side === 'offense' ? 'Offense' : 'Defense'}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: selected.length === total ? '#04a550' : '#777' }}>
          {selected.length}/{total}
        </span>
        <button onClick={onAutoFill}
          style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 10, fontWeight: 800, borderRadius: 6, cursor: 'pointer', background: '#1a2040', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)' }}>
          ⚡ Auto-Fill
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(group => {
          const groupPlayers = roster.filter(p => group.positions.includes(p.positions[0] ?? ''))
          return (
            <div key={group.key}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                {group.label}
              </div>
              {groupPlayers.length === 0 ? (
                <div style={{ fontSize: 11, color: '#444', fontStyle: 'italic' }}>Keine Spieler</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {groupPlayers.map(p => {
                    const isSel = selected.includes(p.id)
                    const order = isSel ? selected.indexOf(p.id) + 1 : null
                    return (
                      <button key={p.id} onClick={() => onToggle(p.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                          border: `1px solid ${isSel ? color : 'rgba(255,255,255,0.08)'}`,
                          background: isSel ? `${color}22` : '#131826', color: isSel ? '#fff' : '#aaa', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' }}>
                        {order != null && (
                          <span style={{ width: 16, height: 16, borderRadius: '50%', background: color, color: textOn(color), fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{order}</span>
                        )}
                        <span style={{ color: isSel ? '#fff' : '#666', fontWeight: 900, fontFamily: '"Arial Black", sans-serif' }}>{p.jersey_number ?? '—'}</span>
                        <span>{p.first_name.charAt(0)}. {p.last_name}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, color: isSel ? color : '#555', letterSpacing: 0.5 }}>{p.positions[0]}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
