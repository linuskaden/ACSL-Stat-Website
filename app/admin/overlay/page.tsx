'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Team = {
  id: string
  name: string
  short_name: string
  primary_color: string
  secondary_color: string
  logo_url: string | null
}

type Player = {
  id: string
  first_name: string
  last_name: string
  jersey_number: string | null
  positions: string[]
  team_id: string
}

type Game = {
  id: string
  status: 'scheduled' | 'live' | 'final'
  game_type: string
  season: number
  week: number | null
  home_score: number | null
  away_score: number | null
  scheduled_at: string | null
  home_team: Team
  away_team: Team
}

type OverlayState = {
  active_player_id: string | null
  game_id: string | null
  mode: 'live' | 'career'
  visible: boolean
}

const STATUS_COLOR: Record<string, string> = {
  live: '#ff1d25',
  final: '#04a550',
  scheduled: '#7a7a7a',
}

export default function OverlayControlPage() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [homePlayers, setHomePlayers] = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([])
  const [overlay, setOverlay] = useState<OverlayState>({
    active_player_id: null,
    game_id: null,
    mode: 'live',
    visible: false,
  })
  const [overlayUrl, setOverlayUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  // Build overlay URL on client only
  useEffect(() => {
    setOverlayUrl(`${window.location.origin}/overlay/lower-third`)
  }, [])

  // Load games + current overlay state on mount
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

      // Auto-select: prefer live game, then whichever game_id is in overlay_state
      const gameList = gs as Game[] ?? []
      const liveGame = gameList.find(g => g.status === 'live')
      const prevGame = os?.game_id ? gameList.find(g => g.id === os.game_id) : null
      const autoGame = liveGame ?? prevGame ?? null

      if (autoGame) {
        setSelectedGame(autoGame)
        await loadPlayers(autoGame)
      }
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPlayers(game: Game) {
    const supabase = createClient()
    const { data } = await supabase
      .from('players')
      .select('id, first_name, last_name, jersey_number, positions, team_id')
      .in('team_id', [game.home_team.id, game.away_team.id])
      .order('jersey_number', { nullsFirst: false })

    if (data) {
      const all = data as Player[]
      setHomePlayers(all.filter(p => p.team_id === game.home_team.id))
      setAwayPlayers(all.filter(p => p.team_id === game.away_team.id))
    }
  }

  const pushOverlay = useCallback(async (patch: Partial<OverlayState>) => {
    const supabase = createClient()
    const next = { ...overlay, ...patch }
    setOverlay(next)
    setSaving(true)
    await supabase
      .from('overlay_state')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1)
    setSaving(false)
  }, [overlay])

  async function handleGameChange(gameId: string) {
    const game = games.find(g => g.id === gameId)
    if (!game) return
    setSelectedGame(game)
    await loadPlayers(game)
    // Update the game_id in overlay_state if a player is already active
    if (overlay.active_player_id) {
      await pushOverlay({ game_id: gameId })
    }
  }

  async function handleSelectPlayer(player: Player) {
    await pushOverlay({
      active_player_id: player.id,
      game_id: selectedGame?.id ?? overlay.game_id,
    })
  }

  async function handleToggleMode() {
    await pushOverlay({ mode: overlay.mode === 'live' ? 'career' : 'live' })
  }

  async function handleToggleVisible() {
    await pushOverlay({ visible: !overlay.visible })
  }

  function copyUrl() {
    navigator.clipboard.writeText(overlayUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function gameLabel(g: Game) {
    const home = g.home_team?.short_name ?? 'TBD'
    const away = g.away_team?.short_name ?? 'TBD'
    const score = g.status !== 'scheduled' ? ` ${g.home_score ?? 0}–${g.away_score ?? 0}` : ''
    const type = g.game_type?.replace('_', ' ') ?? ''
    return `${home} vs ${away}${score} · ${type}${g.status === 'live' ? ' 🔴' : ''}`
  }

  const activePlayer = [...homePlayers, ...awayPlayers].find(p => p.id === overlay.active_player_id)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '24px',
    }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>
            vMix Overlay Control
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#555' }}>
            ACSL Media — Lower Third Player Card
          </p>
        </div>

        {/* Status dot */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {saving && (
            <span style={{ fontSize: 11, color: '#555', letterSpacing: 1 }}>SAVING…</span>
          )}
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: overlay.visible ? '#04a550' : '#333',
            boxShadow: overlay.visible ? '0 0 8px #04a550' : 'none',
            transition: 'background 0.3s, box-shadow 0.3s',
          }} />
          <span style={{ fontSize: 12, color: overlay.visible ? '#04a550' : '#555', fontWeight: 700 }}>
            {overlay.visible ? 'ON AIR' : 'HIDDEN'}
          </span>
        </div>
      </div>

      {/* ── Control bar ── */}
      <div style={{
        background: '#111',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
      }}>
        {/* Game selector */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase' }}>
            Game
          </div>
          <select
            value={selectedGame?.id ?? ''}
            onChange={e => handleGameChange(e.target.value)}
            style={{
              width: '100%',
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '8px 12px',
              color: 'white',
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Select game…</option>
            {games.map(g => (
              <option key={g.id} value={g.id}>{gameLabel(g)}</option>
            ))}
          </select>
        </div>

        {/* Mode toggle */}
        <div>
          <div style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase' }}>
            Stats Mode
          </div>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            {(['live', 'career'] as const).map(m => (
              <button
                key={m}
                onClick={() => pushOverlay({ mode: m })}
                style={{
                  padding: '8px 18px',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: 'pointer',
                  background: overlay.mode === m ? '#ff1d25' : '#0a0a0a',
                  color: overlay.mode === m ? 'white' : '#555',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'live' ? '⚡ Live' : '📊 Career'}
              </button>
            ))}
          </div>
        </div>

        {/* Show / Hide */}
        <div>
          <div style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase' }}>
            Visibility
          </div>
          <button
            onClick={handleToggleVisible}
            style={{
              padding: '9px 28px',
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 1,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: overlay.visible ? '#04a550' : 'rgba(255,255,255,0.1)',
              borderRadius: 8,
              cursor: 'pointer',
              background: overlay.visible ? '#04a550' : '#1a1a1a',
              color: overlay.visible ? 'white' : '#7a7a7a',
              transition: 'all 0.2s',
              boxShadow: overlay.visible ? '0 0 16px rgba(4,165,80,0.3)' : 'none',
            }}
          >
            {overlay.visible ? '▼ HIDE' : '▲ SHOW'}
          </button>
        </div>

        {/* vMix URL */}
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase' }}>
            vMix URL
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 11,
              color: '#aaa',
              whiteSpace: 'nowrap',
            }}>
              {overlayUrl || 'loading…'}
            </code>
            <button
              onClick={copyUrl}
              style={{
                padding: '8px 14px',
                fontSize: 11,
                fontWeight: 700,
                background: copied ? '#04a550' : '#1a1a1a',
                color: copied ? 'white' : '#7a7a7a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Active player banner ── */}
      {activePlayer && (
        <div style={{
          background: '#111',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
          padding: '12px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 8, height: 36, borderRadius: 4,
            background: selectedGame
              ? ([...homePlayers].find(p => p.id === activePlayer.id)
                  ? selectedGame.home_team.primary_color
                  : selectedGame.away_team.primary_color)
              : '#ff1d25',
          }} />
          <div>
            <div style={{ fontSize: 11, color: '#555', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
              Now on overlay
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 0.3 }}>
              {activePlayer.jersey_number && <span style={{ color: '#555', marginRight: 6 }}>#{activePlayer.jersey_number}</span>}
              {activePlayer.first_name} {activePlayer.last_name}
              <span style={{ color: '#555', fontSize: 12, marginLeft: 10, fontWeight: 400 }}>
                {activePlayer.positions.join(' / ')}
              </span>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
              padding: '4px 10px', borderRadius: 4,
              background: overlay.mode === 'live' ? 'rgba(255,29,37,0.15)' : 'rgba(255,255,255,0.05)',
              color: overlay.mode === 'live' ? '#ff1d25' : '#7a7a7a',
            }}>
              {overlay.mode === 'live' ? '⚡ GAME STATS' : '📊 SEASON STATS'}
            </span>
          </div>
        </div>
      )}

      {/* ── Player columns ── */}
      {selectedGame ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <PlayerColumn
            team={selectedGame.home_team}
            players={homePlayers}
            activeId={overlay.active_player_id}
            onSelect={handleSelectPlayer}
            label="HOME"
          />
          <PlayerColumn
            team={selectedGame.away_team}
            players={awayPlayers}
            activeId={overlay.active_player_id}
            onSelect={handleSelectPlayer}
            label="AWAY"
          />
        </div>
      ) : (
        <div style={{
          background: '#111',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '48px',
          textAlign: 'center',
          color: '#333',
          fontSize: 14,
        }}>
          Select a game above to see players
        </div>
      )}
    </div>
  )
}

function PlayerColumn({
  team,
  players,
  activeId,
  onSelect,
  label,
}: {
  team: Team
  players: Player[]
  activeId: string | null
  onSelect: (p: Player) => void
  label: string
}) {
  return (
    <div>
      {/* Team header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
        padding: '10px 14px',
        background: '#111',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        borderLeft: `4px solid ${team.primary_color}`,
      }}>
        {team.logo_url && (
          <img src={team.logo_url} alt="" style={{ width: 28, height: 28, objectFit: 'contain' }} />
        )}
        <div>
          <div style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            {label}
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.2 }}>{team.name}</div>
        </div>
        <div style={{
          marginLeft: 'auto',
          fontSize: 11,
          color: '#555',
          background: 'rgba(255,255,255,0.04)',
          padding: '3px 8px',
          borderRadius: 4,
        }}>
          {players.length} players
        </div>
      </div>

      {/* Player list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {players.length === 0 ? (
          <div style={{
            background: '#111',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            padding: '24px',
            textAlign: 'center',
            color: '#333',
            fontSize: 12,
          }}>
            No players found
          </div>
        ) : (
          players.map(p => {
            const isActive = p.id === activeId
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  background: isActive ? `${team.primary_color}18` : '#111',
                  border: `1px solid ${isActive ? team.primary_color : 'rgba(255,255,255,0.05)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  width: '100%',
                }}
              >
                {/* Team color stripe */}
                <div style={{
                  width: 3,
                  height: 34,
                  borderRadius: 2,
                  background: isActive ? team.primary_color : 'rgba(255,255,255,0.08)',
                  flexShrink: 0,
                  transition: 'background 0.15s',
                }} />

                {/* Jersey number */}
                <div style={{
                  width: 32,
                  textAlign: 'center',
                  fontSize: 18,
                  fontWeight: 900,
                  fontFamily: '"Arial Black", Impact, sans-serif',
                  color: isActive ? team.primary_color : '#555',
                  flexShrink: 0,
                  transition: 'color 0.15s',
                }}>
                  {p.jersey_number ?? '—'}
                </div>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: isActive ? 'white' : '#ccc',
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                    lineHeight: 1.2,
                    transition: 'color 0.15s',
                  }}>
                    {p.first_name} {p.last_name}
                  </div>
                  <div style={{
                    color: isActive ? team.primary_color : '#444',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    marginTop: 2,
                    transition: 'color 0.15s',
                  }}>
                    {p.positions.join(' · ')}
                  </div>
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 1.5,
                    color: team.primary_color,
                    background: `${team.primary_color}20`,
                    padding: '3px 7px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}>
                    ON AIR
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
