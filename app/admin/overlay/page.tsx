'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ─── Types ─── */
type Team = { id: string; name: string; short_name: string; slug: string; primary_color: string; secondary_color: string; logo_url: string | null }
type Player = { id: string; first_name: string; last_name: string; nickname: string | null; jersey_number: string | null; positions: string[]; team_id: string; is_active: boolean; height_cm: number | null; weight_kg: number | null; country: string | null; hometown: string | null; field_of_study: string | null; semester: string | null; acsl_since: string | null; fun_fact: string | null; football_experience: string | null }
type Game = { id: string; status: 'scheduled' | 'live' | 'final'; game_type: string; season: number; home_score: number | null; away_score: number | null; scheduled_at: string | null; home_team: Team; away_team: Team }
type OverlayState = { active_player_id: string | null; game_id: string | null; mode: 'live' | 'career'; visible: boolean }

const POSITIONS = ['Alle', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P']

export default function OverlayControlPage() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [homePlayers, setHomePlayers] = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([])
  const [overlay, setOverlay] = useState<OverlayState>({ active_player_id: null, game_id: null, mode: 'live', visible: false })
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [careerStats, setCareerStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [searchHome, setSearchHome] = useState('')
  const [searchAway, setSearchAway] = useState('')
  const [filterHome, setFilterHome] = useState('Alle')
  const [filterAway, setFilterAway] = useState('Alle')
  const [previewStats, setPreviewStats] = useState<any>(null)
  const [overlayUrl, setOverlayUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setOverlayUrl(`${window.location.origin}/overlay/lower-third`) }, [])

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const [{ data: gs }, { data: os }] = await Promise.all([
        supabase.from('games').select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)').eq('season', 2026).order('scheduled_at', { ascending: false }),
        supabase.from('overlay_state').select('*').eq('id', 1).single(),
      ])
      if (gs) setGames(gs as Game[])
      if (os) setOverlay(os as OverlayState)
      const list = (gs ?? []) as Game[]
      const auto = list.find(g => g.status === 'live') ?? (os?.game_id ? list.find(g => g.id === os.game_id) : null) ?? null
      if (auto) { setSelectedGame(auto); loadPlayers(auto) }
    }
    init()
  }, []) // eslint-disable-line

  async function loadPlayers(game: Game) {
    const supabase = createClient()
    const { data } = await supabase.from('players').select('*').in('team_id', [game.home_team.id, game.away_team.id]).eq('is_active', true).order('jersey_number', { nullsFirst: false })
    if (data) {
      setHomePlayers((data as Player[]).filter(p => p.team_id === game.home_team.id))
      setAwayPlayers((data as Player[]).filter(p => p.team_id === game.away_team.id))
    }
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

  async function handleGameChange(gameId: string) {
    const game = games.find(g => g.id === gameId)
    if (!game) return
    setSelectedGame(game); loadPlayers(game)
    if (overlay.active_player_id) pushOverlay({ game_id: gameId })
  }

  async function showOnOverlay(player: Player, mode: 'live' | 'career') {
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
          <div className="w-2 h-8 rounded-full" style={{ background: [...homePlayers].find(p => p.id === activePlayer.id) ? selectedGame?.home_team.primary_color : selectedGame?.away_team.primary_color ?? '#ff1d25' }} />
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
  if (positions.includes('QB')) return [
    { label: 'PASS YDS', value: s.pass_yards ?? 0 },
    { label: 'TDs', value: (s.pass_tds ?? 0) + (s.qb_rush_tds ?? 0) },
    { label: 'INT', value: s.interceptions_thrown ?? 0 },
    { label: 'C/ATT', value: `${s.pass_completions ?? 0}/${s.pass_attempts ?? 0}` },
    { label: 'RUSH', value: s.qb_rush_yards ?? 0 },
  ]
  if (positions.includes('RB')) return [
    { label: 'RUSH YDS', value: s.rush_yards ?? 0 },
    { label: 'TDs', value: s.rush_tds ?? 0 },
    { label: 'CAR', value: s.rush_carries ?? 0 },
    { label: 'REC YDS', value: s.rb_rec_yards ?? 0 },
    { label: 'REC', value: s.rb_receptions ?? 0 },
  ]
  if (positions.some((p: string) => ['WR', 'TE'].includes(p))) return [
    { label: 'REC YDS', value: s.rec_yards ?? 0 },
    { label: 'TDs', value: s.rec_tds ?? 0 },
    { label: 'REC', value: s.receptions ?? 0 },
    { label: 'TAR', value: s.rec_targets ?? 0 },
  ]
  if (positions.some((p: string) => ['K', 'P'].includes(p))) return [
    { label: 'FG', value: `${s.fg_made ?? 0}/${s.fg_attempts ?? 0}` },
    { label: 'EP', value: `${s.ep_made ?? 0}/${s.ep_attempts ?? 0}` },
    { label: 'PTS', value: (s.fg_made ?? 0) * 3 + (s.ep_made ?? 0) },
  ]
  return [
    { label: 'SACKS', value: s.sacks ?? 0 },
    { label: 'INT', value: s.def_interceptions ?? 0 },
  ]
}

/* ─────────────────────────────────
   Operator Preview
───────────────────────────────── */
function OperatorPreview({ player, team, stats, mode, visible }: {
  player: Player | null
  team: Team | null | undefined
  stats: any
  mode: 'live' | 'career'
  visible: boolean
}) {
  const primaryColor = team?.primary_color ?? '#ff1d25'
  const secondaryColor = team?.secondary_color ?? 'rgba(255,255,255,0.12)'
  const statItems = player ? buildStatItems(player.positions, stats) : []
  const modeLabel = mode === 'career' ? '2026 SEASON' : 'GAME STATS'

  return (
    <div style={{
      background: '#080b14',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 20px',
    }}>
      {/* Section label */}
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
        background: '#1a1a2e',
        borderRadius: 8,
        padding: '24px 20px',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 90,
        display: 'flex',
        alignItems: 'flex-end',
      }}>
        {/* Fake broadcast background texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.015) 0%, transparent 60%)',
        }} />

        {/* "ACSL BROADCAST" watermark */}
        <div style={{
          position: 'absolute', top: 8, right: 12,
          fontSize: 9, fontWeight: 700, letterSpacing: 3,
          color: 'rgba(255,255,255,0.08)', textTransform: 'uppercase',
        }}>
          ACSL Broadcast
        </div>

        {player && team ? (
          /* ── Lower-third card preview ── */
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            height: 80,
            width: '100%',
            maxWidth: 780,
            opacity: visible ? 1 : 0.35,
            transition: 'opacity 0.4s ease',
            filter: visible ? 'none' : 'grayscale(0.5)',
          }}>
            {/* Left: team color block */}
            <div style={{
              background: primaryColor,
              width: 80,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              flexShrink: 0,
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 16, background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.2))' }} />
              {team.logo_url ? (
                <img src={team.logo_url} alt="" style={{ width: 34, height: 34, objectFit: 'contain', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }} />
              ) : (
                <div style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.2)', borderRadius: 3 }} />
              )}
              {player.jersey_number != null && (
                <span style={{ color: 'white', fontSize: 13, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                  #{player.jersey_number}
                </span>
              )}
            </div>

            {/* Accent line */}
            <div style={{ width: 3, background: secondaryColor, flexShrink: 0 }} />

            {/* Right: dark info section */}
            <div style={{ background: '#0d1117', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 16px', gap: 5 }}>
              {/* Name row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1 }}>
                <span style={{ color: 'white', fontSize: 17, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
                  {player.first_name.toUpperCase()} {player.last_name.toUpperCase()}
                </span>
                <span style={{ color: primaryColor, fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase' }}>
                  {player.positions.join(' · ')}
                </span>
                <span style={{ marginLeft: 'auto', color: '#2a2a2a', fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
                  {modeLabel}
                </span>
              </div>

              {/* Stats row */}
              {statItems.length > 0 ? (
                <div style={{ display: 'flex', gap: 0, alignItems: 'flex-end' }}>
                  {statItems.map((item, i) => (
                    <div key={item.label} style={{ textAlign: 'center', paddingRight: 14, paddingLeft: i === 0 ? 0 : 14, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                      <div style={{ color: 'white', fontSize: 19, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', lineHeight: 1 }}>
                        {item.value}
                      </div>
                      <div style={{ color: '#3a3a3a', fontSize: 7, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#222', fontSize: 9, letterSpacing: 1 }}>KEINE STATS</div>
              )}
            </div>
          </div>
        ) : (
          /* ── Placeholder when no player selected ── */
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.25 }}>
            <div style={{ width: 80, height: 80, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }} />
            <div style={{ width: 3, height: 80, background: 'rgba(255,255,255,0.05)' }} />
            <div style={{ flex: 1, height: 80, background: 'rgba(255,255,255,0.03)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, color: '#444', letterSpacing: 2, textTransform: 'uppercase' }}>
                Kein Spieler ausgewählt
              </span>
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
  team: Team; players: Player[]; allPlayers: Player[]; label: string
  search: string; onSearch: (v: string) => void; filter: string; onFilter: (v: string) => void
  activeId: string | null; onSelect: (p: Player) => void; selectedId: string | null
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Team header */}
      <div className="px-4 py-3 border-b border-white/5 flex-shrink-0" style={{ background: `${team.primary_color}0d` }}>
        <div className="flex items-center gap-3 mb-3">
          {team.logo_url
            ? <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: team.primary_color }}>
                <img src={team.logo_url} alt="" className="w-5 h-5 object-contain" />
              </div>
            : <div className="w-7 h-7 rounded flex items-center justify-center text-[9px] font-black text-white flex-shrink-0" style={{ background: team.primary_color }}>{team.short_name.slice(0,2)}</div>
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
              style={{ background: filter === pos ? team.primary_color : 'rgba(255,255,255,0.05)', color: filter === pos ? 'white' : '#666' }}>
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
                    background: isActive ? `${team.primary_color}25` : isSelected ? 'rgba(255,255,255,0.08)' : '#171c2e',
                    border: `1px solid ${isActive ? team.primary_color : isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
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
                      color: isActive ? team.primary_color : 'rgba(255,255,255,0.65)',
                      lineHeight: 1,
                    }}>
                      {p.jersey_number ?? '—'}
                    </span>
                    <span style={{
                      background: team.primary_color,
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
                      {isActive && <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: 0.5, color: team.primary_color }}>AIR</div>}
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
function PlayerModal({ player, team, careerStats, loadingStats, overlayActiveId, overlayVisible, onClose, onShow, onHide }: {
  player: Player; team: Team | null | undefined
  careerStats: any; loadingStats: boolean
  overlayActiveId: string | null; overlayVisible: boolean
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
        <div style={{ margin: '0 16px 16px', background: isOnAir ? 'rgba(4,165,80,0.08)' : `${primaryColor}0a`, border: `1px solid ${isOnAir ? '#04a550' : `${primaryColor}30`}`, borderRadius: 10, padding: 12 }}>
          {isOnAir && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 11, color: '#04a550', fontWeight: 700 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#04a550', boxShadow: '0 0 5px #04a550' }} />
              AUF OVERLAY {overlayVisible ? '· SICHTBAR' : '· VERBORGEN'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onShow('live')} style={{ flex: 1, padding: '10px 8px', fontSize: 12, fontWeight: 800, border: 'none', borderRadius: 8, cursor: 'pointer', background: '#ff1d25', color: 'white' }}>
              ▲ Live Stats einblenden
            </button>
            <button onClick={() => onShow('career')} style={{ flex: 1, padding: '10px 8px', fontSize: 12, fontWeight: 800, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', color: '#aaa' }}>
              📊 Saisonwerte
            </button>
          </div>
          {isOnAir && overlayVisible && (
            <button onClick={onHide} style={{ width: '100%', marginTop: 8, padding: '7px', fontSize: 11, fontWeight: 700, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, cursor: 'pointer', background: 'transparent', color: '#666' }}>
              ▼ Ausblenden
            </button>
          )}
        </div>

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
