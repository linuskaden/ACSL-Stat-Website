'use client'
import { useState, useMemo } from 'react'
import { PlayerCard, PlayerDetailPanel, usePlayerSeasonStats, type Player, type Team } from '@/components/TeamRosterGrid'

type Game = {
  id: string; status: string; scheduled_at: string | null; stage: string | null
  home_team: Team | null; away_team: Team | null
}
type Coach = {
  id: string; team_id: string; first_name: string; last_name: string; role: string | null
  country: string | null; hometown: string | null; football_experience: string | null; fun_fact: string | null; sort_order: number | null
}

function gameLabel(g: Game): string {
  const date = g.scheduled_at
    ? new Date(g.scheduled_at).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Vienna' })
    : 'TBD'
  const h = g.home_team?.short_name ?? '?', a = g.away_team?.short_name ?? '?'
  const live = g.status === 'live' ? '🔴 ' : g.status === 'final' ? '✓ ' : ''
  return `${live}${h} vs ${a} · ${date}${g.stage ? ' · ' + g.stage : ''}`
}

const jnum = (p: Player) => {
  const v = p.jersey_number
  if (v == null || String(v).trim() === '') return Infinity
  const n = Number(v); return Number.isFinite(n) ? n : Infinity
}

function CoachCard({ coach, color }: { coach: Coach; color: string }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--fg)' }}>{coach.first_name} {coach.last_name}</div>
        {coach.role && <span style={{ background: color, color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: 0.5, padding: '3px 7px', borderRadius: 4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{coach.role}</span>}
      </div>
      {coach.fun_fact && <div style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--fg)', marginTop: 7, lineHeight: 1.45 }}>„{coach.fun_fact}"</div>}
      {coach.football_experience && <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 6, lineHeight: 1.4 }}><span style={{ fontWeight: 700 }}>Erfahrung: </span>{coach.football_experience}</div>}
      {coach.hometown && <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 5 }}>{coach.hometown}{coach.country ? ` · ${coach.country}` : ''}</div>}
    </div>
  )
}

function TeamColumn({ team, players, coaches, mode, selectedId, onSelect, align }: {
  team: Team | null; players: Player[]; coaches: Coach[]; mode: 'players' | 'coaches'; selectedId?: string | null; onSelect: (p: Player) => void; align: 'left' | 'right'
}) {
  if (!team) return <div />
  const color = team.primary_color || '#16163f'
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 4px', marginBottom: 10,
        borderBottom: `2px solid ${color}`, flexDirection: align === 'right' ? 'row-reverse' : 'row',
      }}>
        {team.logo_url
          ? <img src={team.logo_url} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          : <div style={{ width: 40, height: 40, borderRadius: 6, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13 }}>{team.short_name.slice(0, 2)}</div>}
        <div style={{ textAlign: align === 'right' ? 'right' : 'left' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--fg)', lineHeight: 1.1 }}>{team.name}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>{mode === 'coaches' ? `${coaches.length} Coaches` : `${players.length} Spieler`}</div>
        </div>
      </div>
      {mode === 'coaches' ? (
        coaches.length === 0
          ? <div style={{ color: 'var(--fg-faint)', fontSize: 12, fontStyle: 'italic', padding: '8px 4px' }}>Keine Coaches hinterlegt.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{coaches.map(c => <CoachCard key={c.id} coach={c} color={color} />)}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          {players.map(p => (
            <PlayerCard key={p.id} player={p} team={team} isSelected={selectedId === p.id} isOnAir={false} onClick={() => onSelect(p)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommentaryMatchView({ games, players, coaches, season }: { games: Game[]; players: Player[]; coaches: Coach[]; season?: number }) {
  const firstDefault = games.find(g => g.status === 'live') || games.find(g => g.status === 'scheduled') || games[0]
  const [gameId, setGameId] = useState<string>(firstDefault?.id ?? '')
  const [mode, setMode] = useState<'players' | 'coaches'>('players')
  const [selected, setSelected] = useState<Player | null>(null)
  const { careerStats, loadingStats } = usePlayerSeasonStats(selected?.id ?? null, season)
  const teamCoaches = (teamId?: string | null) => !teamId ? [] : coaches.filter(c => c.team_id === teamId).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))

  const game = useMemo(() => games.find(g => g.id === gameId) ?? null, [games, gameId])
  const teamsById = useMemo(() => {
    const m: Record<string, Team> = {}
    for (const g of games) { if (g.home_team) m[g.home_team.id] = g.home_team; if (g.away_team) m[g.away_team.id] = g.away_team }
    return m
  }, [games])
  const teamPlayers = (teamId?: string | null) => !teamId ? [] : players.filter(p => p.team_id === teamId && p.is_active).sort((a, b) => jnum(a) - jnum(b))

  return (
    <div>
      {/* Match selector bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--fg-faint)' }}>Match</span>
        <select
          value={gameId}
          onChange={e => { setGameId(e.target.value); setSelected(null) }}
          style={{ flex: 1, maxWidth: 520, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--fg)', fontSize: 14, fontWeight: 600 }}
        >
          {games.length === 0 && <option value="">Keine Spiele</option>}
          {games.map(g => <option key={g.id} value={g.id}>{gameLabel(g)}</option>)}
        </select>
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['players', 'coaches'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setSelected(null) }}
              style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: mode === m ? 'var(--fg)' : 'var(--surface-2)', color: mode === m ? 'var(--bg)' : 'var(--fg-muted)' }}>
              {m === 'players' ? 'Spieler' : 'Coaches'}
            </button>
          ))}
        </div>
        {game && mode === 'players' && <span style={{ fontSize: 12, color: 'var(--fg-faint)' }}>Klick auf einen Spieler für Details &amp; Fun Facts</span>}
      </div>

      {!game ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-faint)' }}>Kein Match ausgewählt.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, padding: 16, alignItems: 'start' }}>
          <TeamColumn team={game.home_team} players={teamPlayers(game.home_team?.id)} coaches={teamCoaches(game.home_team?.id)} mode={mode} selectedId={selected?.id} onSelect={setSelected} align="left" />
          <TeamColumn team={game.away_team} players={teamPlayers(game.away_team?.id)} coaches={teamCoaches(game.away_team?.id)} mode={mode} selectedId={selected?.id} onSelect={setSelected} align="right" />
        </div>
      )}

      {/* Detail overlay */}
      {selected && teamsById[selected.team_id] && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelected(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div style={{ position: 'relative', height: '100vh', display: 'flex', boxShadow: '-12px 0 40px rgba(0,0,0,0.3)' }}>
            <PlayerDetailPanel
              player={selected}
              team={teamsById[selected.team_id]}
              careerStats={careerStats}
              loadingStats={loadingStats}
              overlayMode={false}
              onClose={() => setSelected(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
