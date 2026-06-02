'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Team = {
  id: string; name: string; short_name: string
  primary_color: string; secondary_color: string; logo_url: string | null
}
type TeamOverlayState = {
  game_id: string | null
  display_team: 'both' | 'home' | 'away'
  visible: boolean
}
type TeamStats = {
  passYds: number; rushYds: number; recYds: number; totalYds: number
  tds: number; ints: number; fumbles: number
  targets: number; receptions: number
}

function emptyStats(): TeamStats {
  return { passYds: 0, rushYds: 0, recYds: 0, totalYds: 0, tds: 0, ints: 0, fumbles: 0, targets: 0, receptions: 0 }
}

function calcStats(players: any[], gameStatsRows: any[]): TeamStats {
  const s = emptyStats()
  players.forEach(p => {
    const rows = gameStatsRows.filter(r => r.player_id === p.id)
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
    } else if (pos.some(pp => ['K', 'P'].includes(pp))) {
      s.tds += 0 // kicker TDs don't go here
    }
  })
  s.totalYds = s.passYds + s.rushYds
  return s
}

function textOn(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.48 ? '#000000' : '#ffffff'
}

export default function TeamStatsOverlay() {
  const [state, setState]           = useState<TeamOverlayState | null>(null)
  const [homeTeam, setHomeTeam]     = useState<Team | null>(null)
  const [awayTeam, setAwayTeam]     = useState<Team | null>(null)
  const [homePlayers, setHomePlayers] = useState<any[]>([])
  const [awayPlayers, setAwayPlayers] = useState<any[]>([])
  const [gameStats, setGameStats]   = useState<any[]>([])
  const [visible, setVisible]       = useState(false)

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

      const { data: game } = await supabase
        .from('games')
        .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
        .eq('id', s.game_id).single()
      if (!game) return

      setHomeTeam((game as any).home_team ?? null)
      setAwayTeam((game as any).away_team ?? null)

      const teamIds = [(game as any).home_team?.id, (game as any).away_team?.id].filter(Boolean)
      const [{ data: players }, { data: gs }] = await Promise.all([
        supabase.from('players').select('*').in('team_id', teamIds),
        supabase.from('game_stats').select('*').eq('game_id', s.game_id),
      ])
      setHomePlayers((players ?? []).filter((p: any) => p.team_id === (game as any).home_team?.id))
      setAwayPlayers((players ?? []).filter((p: any) => p.team_id === (game as any).away_team?.id))
      setGameStats(gs ?? [])
    }

    loadAll()

    const ch = supabase.channel('team-stats-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_overlay_state' },
        ({ new: row }) => loadAll(row as TeamOverlayState))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats' },
        () => loadAll())
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [])

  const displayTeam = state?.display_team ?? 'both'
  const showHome = displayTeam === 'both' || displayTeam === 'home'
  const showAway = displayTeam === 'both' || displayTeam === 'away'

  const homeStats = calcStats(homePlayers, gameStats)
  const awayStats = calcStats(awayPlayers, gameStats)

  return (
    <div style={{
      position: 'absolute',
      bottom: 56,
      left: 72,
      transition: 'transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease',
      transform: visible ? 'translateY(0)' : 'translateY(160%)',
      opacity: visible ? 1 : 0,
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 3,
        boxShadow: '0 20px 60px rgba(0,0,0,0.85), 0 4px 20px rgba(0,0,0,0.6)',
      }}>
        {showHome && homeTeam && (
          <TeamRow team={homeTeam} stats={homeStats} />
        )}
        {showAway && awayTeam && (
          <TeamRow team={awayTeam} stats={awayStats} />
        )}
      </div>
    </div>
  )
}

function TeamRow({ team, stats }: { team: Team; stats: TeamStats }) {
  const color       = team.primary_color ?? '#ff1d25'
  const onColor     = textOn(color)
  const hairline    = onColor === '#ffffff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'
  const dimOnColor  = onColor === '#ffffff' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.50)'
  const catchPct    = stats.targets > 0 ? Math.round(stats.receptions / stats.targets * 100) : 0

  const statCols: { label: string; value: string | number }[] = [
    { label: 'PASS',    value: stats.passYds  },
    { label: 'RUSH',    value: stats.rushYds  },
    { label: 'REC',     value: stats.recYds   },
    { label: 'TOTAL',   value: stats.totalYds },
    { label: 'REC/TAR', value: `${stats.receptions}/${stats.targets}` },
    { label: 'CATCH%',  value: stats.targets > 0 ? `${catchPct}%` : '—' },
    { label: 'TDs',     value: stats.tds      },
    { label: 'INT',     value: stats.ints     },
    { label: 'FUM',     value: stats.fumbles  },
  ]

  return (
    <div style={{ display: 'inline-flex', alignItems: 'stretch' }}>
      {/* Team identity block */}
      <div style={{
        background: color,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px 8px 10px',
        minWidth: 160,
        flexShrink: 0,
      }}>
        {team.logo_url && (
          <img src={team.logo_url} alt="" style={{ width: 44, height: 44, objectFit: 'contain', flexShrink: 0 }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{
            color: onColor,
            fontSize: 18,
            fontWeight: 900,
            fontFamily: '"Arial Black", Impact, sans-serif',
            letterSpacing: 0.5,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}>
            {team.short_name.toUpperCase()}
          </span>
          <span style={{
            color: dimOnColor,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: 'uppercase',
            lineHeight: 1,
          }}>
            {team.name}
          </span>
        </div>
      </div>

      {/* Stats block */}
      <div style={{
        background: '#0b0e1a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        borderTop: `2px solid ${color}`,
        gap: 0,
      }}>
        {statCols.map((col, i) => (
          <div key={col.label} style={{
            textAlign: 'center',
            padding: '8px 14px',
            borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
          }}>
            <div style={{
              color: col.label === 'TDs'  ? '#04a550'
                   : col.label === 'INT'  ? '#ff1d25'
                   : '#ffffff',
              fontSize: 20,
              fontWeight: 900,
              fontFamily: '"Arial Black", Impact, sans-serif',
              lineHeight: 1,
              letterSpacing: -0.5,
            }}>
              {col.value}
            </div>
            <div style={{
              color: '#7a7a9a',
              fontSize: 7,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginTop: 3,
            }}>
              {col.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
