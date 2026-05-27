'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TeamRosterGrid from '@/components/TeamRosterGrid'

type Team = {
  id: string; name: string; short_name: string; slug: string
  primary_color: string; secondary_color: string; logo_url: string | null
  university: string | null
}
type Game = {
  id: string; status: 'scheduled' | 'live' | 'final'
  game_type: string; season: number; week: number | null
  home_score: number | null; away_score: number | null
  scheduled_at: string | null
  home_team: Team; away_team: Team
}
type Player = { id: string; first_name: string; last_name: string; positions: string[]; team_id: string; [key: string]: any }
type OverlayState = {
  active_player_id: string | null; game_id: string | null
  mode: 'live' | 'career'; visible: boolean
}

export default function OverlayControlPage() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [homePlayers, setHomePlayers] = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([])
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home')
  const [overlay, setOverlay] = useState<OverlayState>({
    active_player_id: null, game_id: null, mode: 'live', visible: false,
  })
  const [overlayUrl, setOverlayUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setOverlayUrl(`${window.location.origin}/overlay/lower-third`)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const [{ data: gs }, { data: os }] = await Promise.all([
        supabase
          .from('games')
          .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
          .eq('season', 2026)
          .order('scheduled_at', { ascending: false }),
        supabase.from('overlay_state').select('*').eq('id', 1).single(),
      ])
      if (gs) setGames(gs as Game[])
      if (os) setOverlay(os as OverlayState)

      const gameList = (gs ?? []) as Game[]
      const autoGame = gameList.find(g => g.status === 'live')
        ?? (os?.game_id ? gameList.find(g => g.id === os.game_id) : null)
        ?? null
      if (autoGame) {
        setSelectedGame(autoGame)
        await loadPlayers(autoGame)
      }
    }
    init()
  }, []) // eslint-disable-line

  async function loadPlayers(game: Game) {
    const supabase = createClient()
    const { data } = await supabase
      .from('players')
      .select('*')
      .in('team_id', [game.home_team.id, game.away_team.id])
      .eq('is_active', true)
      .order('jersey_number', { nullsFirst: false })
    if (data) {
      setHomePlayers((data as Player[]).filter(p => p.team_id === game.home_team.id))
      setAwayPlayers((data as Player[]).filter(p => p.team_id === game.away_team.id))
    }
  }

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
    setSelectedGame(game)
    await loadPlayers(game)
    if (overlay.active_player_id) await pushOverlay({ game_id: gameId })
  }

  async function handleOverlayPush(player: Player, mode: 'live' | 'career') {
    await pushOverlay({
      active_player_id: player.id,
      game_id: selectedGame?.id ?? overlay.game_id,
      mode,
      visible: true,
    })
  }

  function copyUrl() {
    navigator.clipboard.writeText(overlayUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  function gameLabel(g: Game) {
    const score = g.status !== 'scheduled' ? ` ${g.home_score ?? 0}–${g.away_score ?? 0}` : ''
    return `${g.home_team?.short_name ?? '?'} vs ${g.away_team?.short_name ?? '?'}${score} · ${g.game_type?.replace('_', ' ')}${g.status === 'live' ? ' 🔴' : ''}`
  }

  const currentTeam = selectedGame
    ? (activeTeam === 'home' ? selectedGame.home_team : selectedGame.away_team)
    : null
  const currentPlayers = activeTeam === 'home' ? homePlayers : awayPlayers

  return (
    <div style={{ minHeight: '100vh', background: '#0c0f1a', color: 'white', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Top control bar ── */}
      <div style={{
        background: '#080b14',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 14,
        alignItems: 'center',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        {/* Title + status */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.3 }}>vMix Overlay Control</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: overlay.visible ? '#04a550' : '#333',
              boxShadow: overlay.visible ? '0 0 8px #04a550' : 'none',
            }} />
            <span style={{ fontSize: 10, color: overlay.visible ? '#04a550' : '#555', fontWeight: 700, letterSpacing: 1 }}>
              {overlay.visible ? 'ON AIR' : 'HIDDEN'}
            </span>
            {saving && <span style={{ fontSize: 10, color: '#444', marginLeft: 4 }}>saving…</span>}
          </div>
        </div>

        {/* Game selector */}
        <select
          value={selectedGame?.id ?? ''}
          onChange={e => handleGameChange(e.target.value)}
          style={{
            background: '#131826', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, padding: '7px 12px', color: 'white',
            fontSize: 12, outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="">Spiel auswählen…</option>
          {games.map(g => <option key={g.id} value={g.id}>{gameLabel(g)}</option>)}
        </select>

        {/* Hide button */}
        <button
          onClick={() => pushOverlay({ visible: !overlay.visible })}
          style={{
            padding: '8px 20px',
            fontSize: 12, fontWeight: 800, letterSpacing: 0.5,
            borderRadius: 8, cursor: 'pointer',
            borderWidth: 1, borderStyle: 'solid',
            borderColor: overlay.visible ? '#04a550' : 'rgba(255,255,255,0.1)',
            background: overlay.visible ? 'rgba(4,165,80,0.15)' : 'rgba(255,255,255,0.04)',
            color: overlay.visible ? '#04a550' : '#888',
            transition: 'all 0.2s',
          }}
        >
          {overlay.visible ? '▼ Ausblenden' : '▲ Einblenden'}
        </button>

        {/* vMix URL */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <code style={{
            background: '#131826', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#888',
          }}>
            {overlayUrl || '…'}
          </code>
          <button
            onClick={copyUrl}
            style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 700,
              background: copied ? '#04a550' : '#1a2040',
              color: copied ? 'white' : '#888',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {copied ? '✓' : 'Copy'}
          </button>
        </div>
      </div>

      {/* ── Team tabs (when game selected) ── */}
      {selectedGame && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#080b14',
          paddingLeft: 20,
        }}>
          {(['home', 'away'] as const).map(side => {
            const t = side === 'home' ? selectedGame.home_team : selectedGame.away_team
            const isActive = activeTeam === side
            return (
              <button
                key={side}
                onClick={() => setActiveTeam(side)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: isActive ? `2px solid ${t.primary_color}` : '2px solid transparent',
                  color: isActive ? 'white' : '#666',
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.15s',
                  marginBottom: -1,
                }}
              >
                {t.logo_url && (
                  <div style={{
                    width: 20, height: 20, background: t.primary_color,
                    borderRadius: 4, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img src={t.logo_url} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                  </div>
                )}
                {t.short_name}
                <span style={{ fontSize: 10, color: '#555' }}>
                  {side === 'home' ? 'HOME' : 'AWAY'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Player grid ── */}
      {currentTeam && currentPlayers.length > 0 ? (
        <TeamRosterGrid
          team={currentTeam}
          players={currentPlayers}
          allTeams={[]}
          overlayMode
          onOverlayPush={handleOverlayPush}
          overlayActiveId={overlay.active_player_id}
          overlayVisible={overlay.visible}
        />
      ) : (
        <div style={{
          padding: '48px', textAlign: 'center',
          color: '#333', fontSize: 14,
        }}>
          {selectedGame ? 'Keine Spieler gefunden' : 'Wähle ein Spiel aus, um Spieler zu sehen'}
        </div>
      )}
    </div>
  )
}
