'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Player, Team } from '@/lib/supabase/types'

type Game = { id: string; season: number; home_score: number | null; away_score: number | null; status: string; home_team: Team; away_team: Team }
type StatRow = Record<string, number>
type AllStats = Record<string, Record<string, StatRow>> // [quarter][playerId]

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'OT']
const FIELDS = ['fg_made', 'fg_att', 'three_made', 'three_att', 'ft_made', 'ft_att', 'reb', 'assists'] as const
const HEADERS = ['FGM', 'FGA', '3PM', '3PA', 'FTM', 'FTA', 'REB', 'AST']

function darkSafe(hex?: string | null): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return '#ff1d25'
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (lum >= 0.22) return hex
  const t = 0.65
  const f = (x: number) => Math.round(x + (255 - x) * t).toString(16).padStart(2, '0')
  return `#${f(r)}${f(g)}${f(b)}`
}

// FGM includes made 3s, so PTS = 2*FGM + 3PM + FTM
function pts(s: StatRow): number {
  return 2 * (s.fg_made ?? 0) + (s.three_made ?? 0) + (s.ft_made ?? 0)
}

function teamPoints(stats: AllStats, players: Player[]): number {
  let score = 0
  players.forEach(p => QUARTERS.forEach(q => { score += pts(stats[q]?.[p.id] ?? {}) }))
  return score
}

function playerTotals(all: AllStats, playerId: string): StatRow {
  const t: StatRow = {}
  QUARTERS.forEach(q => {
    const qs = all[q]?.[playerId] ?? {}
    Object.entries(qs).forEach(([k, v]) => { if (typeof v === 'number') t[k] = (t[k] ?? 0) + v })
  })
  return t
}

function teamTotals(all: AllStats, players: Player[], quarter: string): StatRow & { pts: number } {
  const acc: StatRow = {}
  players.forEach(p => {
    const qs = quarter === 'Total' ? playerTotals(all, p.id) : (all[quarter]?.[p.id] ?? {})
    for (const k of FIELDS) acc[k] = (acc[k] ?? 0) + (qs[k] ?? 0)
  })
  return { ...acc, pts: 2 * (acc.fg_made ?? 0) + (acc.three_made ?? 0) + (acc.ft_made ?? 0) }
}

export default function BballTracker({ game, homePlayers, awayPlayers, initialStats }: {
  game: Game; homePlayers: Player[]; awayPlayers: Player[]; initialStats: any[]
}) {
  const supabase = createClient()
  const [quarter, setQuarter] = useState('Q1')
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home')
  const [allStats, setAllStats] = useState<AllStats>(() => {
    const s: AllStats = {}
    QUARTERS.forEach(q => { s[q] = {} })
    initialStats.forEach(st => { if (!s[st.quarter]) s[st.quarter] = {}; s[st.quarter][st.player_id] = st })
    return s
  })
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [homeScore, setHomeScore] = useState(game.home_score ?? 0)
  const [awayScore, setAwayScore] = useState(game.away_score ?? 0)
  const [saveError, setSaveError] = useState(false)
  const [status, setStatus] = useState(game.status)
  const statusRef = useRef(status); statusRef.current = status
  const allStatsRef = useRef(allStats); allStatsRef.current = allStats
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingSaves = useRef<Record<string, { playerId: string; q: string }>>({})
  const scoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wentLiveRef = useRef(false)

  // Realtime merge from other tracker instances
  useEffect(() => {
    const sb = createClient()
    const ch = sb.channel(`bball-sync-${game.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bball_game_stats', filter: `game_id=eq.${game.id}` },
        ({ new: row, eventType }) => {
          if (eventType === 'DELETE') return
          const r = row as any
          if (!r.player_id || !r.quarter) return
          if (saveTimers.current[`${r.quarter}-${r.player_id}`]) return
          setAllStats(prev => {
            const next = { ...prev }
            if (!next[r.quarter]) next[r.quarter] = {}
            next[r.quarter] = { ...next[r.quarter], [r.player_id]: { ...(next[r.quarter][r.player_id] ?? {}), ...r } }
            return next
          })
        })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [game.id]) // eslint-disable-line

  // Auto score from points
  useEffect(() => {
    const h = teamPoints(allStats, homePlayers), a = teamPoints(allStats, awayPlayers)
    setHomeScore(h); setAwayScore(a)
    if (scoreTimer.current) clearTimeout(scoreTimer.current)
    scoreTimer.current = setTimeout(() => { void supabase.from('games').update({ home_score: h, away_score: a }).eq('id', game.id) }, 1000)
  }, [allStats]) // eslint-disable-line

  const activePlayers = activeTeam === 'home' ? homePlayers : awayPlayers
  const activeTeamData = activeTeam === 'home' ? game.home_team : game.away_team
  const getStat = (playerId: string, field: string, q = quarter) => allStats[q]?.[playerId]?.[field] ?? 0

  const setStat = useCallback((playerId: string, field: string, value: number) => {
    setAllStats(prev => {
      const next = { ...prev }
      if (!next[quarter]) next[quarter] = {}
      next[quarter][playerId] = { ...(next[quarter][playerId] ?? {}), [field]: value }
      return next
    })
    const q = quarter
    const key = `${q}-${playerId}`
    pendingSaves.current[key] = { playerId, q }
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key])
    setSaving(s => ({ ...s, [key]: true }))
    saveTimers.current[key] = setTimeout(() => persistStat(playerId, q), 800)
  }, [quarter])

  async function persistStat(playerId: string, q: string) {
    const player = [...homePlayers, ...awayPlayers].find(p => p.id === playerId)
    if (!player) return
    const stats = allStatsRef.current[q]?.[playerId] ?? {}
    const key = `${q}-${playerId}`
    const payload: any = { game_id: game.id, player_id: playerId, team_id: player.team_id, quarter: q }
    for (const f of FIELDS) payload[f] = stats[f] ?? 0

    const { error } = await supabase.from('bball_game_stats').upsert(payload, { onConflict: 'game_id,player_id,quarter' })
    if (error) {
      console.error('bball_game_stats save failed', error.message)
      setSaveError(true)
      if (saveTimers.current[key]) clearTimeout(saveTimers.current[key])
      saveTimers.current[key] = setTimeout(() => persistStat(playerId, q), 2500)
      return
    }
    delete pendingSaves.current[key]; delete saveTimers.current[key]
    setSaving(s => { const n = { ...s }; delete n[key]; return n })
    setSaveError(false)

    if (statusRef.current === 'scheduled' && !wentLiveRef.current) {
      wentLiveRef.current = true
      setStatus('live')
      await supabase.from('games').update({ status: 'live' }).eq('id', game.id)
    }
  }

  // Flush pending saves on hide/unload/unmount
  useEffect(() => {
    const flush = () => Object.entries(pendingSaves.current).forEach(([key, { playerId, q }]) => {
      if (saveTimers.current[key]) { clearTimeout(saveTimers.current[key]); delete saveTimers.current[key] }
      void persistStat(playerId, q)
    })
    const onVis = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('beforeunload', flush); document.removeEventListener('visibilitychange', onVis); flush() }
  }, []) // eslint-disable-line

  async function setGameStatus(s: string) {
    setStatus(s)
    wentLiveRef.current = (s !== 'scheduled')
    await supabase.from('games').update({ status: s }).eq('id', game.id)
  }

  async function finalizeGame() {
    if (!confirm('Spiel abschließen?')) return
    await Promise.all(Object.entries(pendingSaves.current).map(([key, { playerId, q }]) => {
      if (saveTimers.current[key]) { clearTimeout(saveTimers.current[key]); delete saveTimers.current[key] }
      return persistStat(playerId, q)
    }))
    await supabase.from('games').update({ status: 'final', home_score: homeScore, away_score: awayScore }).eq('id', game.id)
    setStatus('final')
    alert('Spiel abgeschlossen.')
  }

  const totals = teamTotals(allStats, activePlayers, quarter)
  const readOnly = quarter === 'Total'

  return (
    <div className="max-h-screen flex flex-col bg-[#f7f8fa] dark:bg-[#0a0a0a]">
      {/* Top bar */}
      <div className="bg-white dark:bg-[#111] border-b border-black/10 dark:border-white/10 px-4 py-2 flex items-center gap-4 shrink-0 flex-wrap">
        <Link href="/admin/games" className="text-xs text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">← Games</Link>
        <div className="font-bold text-sm">
          <span style={{ color: darkSafe(game.home_team.primary_color) }}>{game.home_team.short_name}</span>
          <span className="text-slate-400 dark:text-[#7a7a7a] mx-2">{homeScore}–{awayScore}</span>
          <span style={{ color: darkSafe(game.away_team.primary_color) }}>{game.away_team.short_name}</span>
        </div>

        <div className="flex gap-1 ml-2">
          {[...QUARTERS, 'Total'].map(q => (
            <button key={q} onClick={() => setQuarter(q)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${quarter === q ? 'bg-[#ff1d25] text-white' : 'text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white bg-[#f1f5f9] dark:bg-[#1a1a1a]'}`}>
              {q}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {saveError ? <span className="text-xs text-[#ff1d25] font-semibold">⚠ Nicht gespeichert – neuer Versuch…</span>
            : Object.keys(saving).length > 0 ? <span className="text-xs text-slate-500 dark:text-[#7a7a7a] animate-pulse">Speichert…</span>
            : <span className="text-xs text-[#04a550]/80">✓ Gespeichert</span>}
          <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${status === 'live' ? 'bg-[#ff1d25]/15 text-[#ff1d25] animate-pulse' : status === 'final' ? 'bg-[#04a550]/15 text-[#04a550]' : 'bg-black/10 dark:bg-white/10 text-slate-500 dark:text-[#7a7a7a]'}`}>
            {status === 'live' ? '● Live' : status === 'final' ? 'Abgeschlossen' : 'Geplant'}
          </span>
          {status !== 'final' && (
            <button onClick={() => setGameStatus(status === 'live' ? 'scheduled' : 'live')}
              className={`text-xs px-3 py-1.5 rounded transition-colors font-medium border ${status === 'live' ? 'border-black/15 dark:border-white/15 text-slate-500 dark:text-[#7a7a7a] hover:bg-black/5 dark:hover:bg-white/5' : 'border-[#ff1d25]/40 text-[#ff1d25] hover:bg-[#ff1d25]/10'}`}>
              {status === 'live' ? 'Live beenden' : '● LIVE schalten'}
            </button>
          )}
          <button onClick={finalizeGame} className="text-xs border border-[#04a550]/40 text-[#04a550] hover:bg-[#04a550]/10 px-3 py-1.5 rounded transition-colors font-medium">
            Abschließen
          </button>
        </div>
      </div>

      {/* Team selector + totals */}
      <div className="bg-white dark:bg-[#111] border-b border-black/[0.07] dark:border-white/5 px-4 py-2 flex items-center gap-6 shrink-0 flex-wrap">
        <div className="flex gap-1">
          {(['home', 'away'] as const).map(side => {
            const t = side === 'home' ? game.home_team : game.away_team
            return (
              <button key={side} onClick={() => setActiveTeam(side)}
                style={activeTeam === side ? { borderColor: darkSafe(t.primary_color), color: darkSafe(t.primary_color) } : {}}
                className={`px-4 py-1.5 rounded text-sm font-bold transition-colors border ${activeTeam === side ? 'bg-black/[0.04] dark:bg-white/5' : 'border-transparent text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white'}`}>
                {t.short_name}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-[#7a7a7a] flex-wrap">
          <span>PTS: <strong className="text-slate-900 dark:text-white">{totals.pts}</strong></span>
          <span>REB: <strong className="text-slate-900 dark:text-white">{totals.reb ?? 0}</strong></span>
          <span>AST: <strong className="text-slate-900 dark:text-white">{totals.assists ?? 0}</strong></span>
          <span>FG: <strong className="text-slate-900 dark:text-white">{totals.fg_made ?? 0}/{totals.fg_att ?? 0}</strong></span>
          <span>3P: <strong className="text-slate-900 dark:text-white">{totals.three_made ?? 0}/{totals.three_att ?? 0}</strong></span>
          <span>FT: <strong className="text-slate-900 dark:text-white">{totals.ft_made ?? 0}/{totals.ft_att ?? 0}</strong></span>
        </div>
      </div>

      {/* Stats table */}
      <div className="flex-1 overflow-auto">
        {activePlayers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-[#7a7a7a] text-sm">Keine Spieler für dieses Team.</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f1f5f9] dark:bg-[#1a1a1a]">
                <th className="text-left px-3 py-1.5 text-slate-500 dark:text-[#7a7a7a] font-semibold uppercase tracking-wider border-b border-black/10 dark:border-white/10 w-40">
                  <span style={{ color: darkSafe(activeTeamData?.primary_color) }}>{activeTeamData?.short_name}</span>
                </th>
                <th className="px-2 py-1.5 text-slate-500 dark:text-[#7a7a7a] border-b border-black/10 dark:border-white/10 w-8">#</th>
                {HEADERS.map(h => (
                  <th key={h} className="text-center px-2 py-1.5 text-slate-500 dark:text-[#7a7a7a] font-medium border-b border-black/10 dark:border-white/10 min-w-[52px]">{h}</th>
                ))}
                <th className="text-center px-2 py-1.5 italic text-slate-400 dark:text-[#4a4a4a] border-b border-l-2 border-black/10 dark:border-white/10 border-l-black/20 dark:border-l-white/[0.12] bg-black/[0.025] dark:bg-white/[0.03] min-w-[48px]">PTS</th>
              </tr>
            </thead>
            <tbody>
              {activePlayers.map(player => {
                const st = readOnly ? playerTotals(allStats, player.id) : (allStats[quarter]?.[player.id] ?? {})
                return (
                  <tr key={player.id} className="border-b border-black/[0.05] dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                      {player.first_name[0]}. {player.last_name}
                      {player.positions.length > 0 && (
                        <span className="ml-1.5 text-[9px] text-slate-500 dark:text-[#7a7a7a] bg-black/[0.06] dark:bg-white/5 px-1 py-0.5 rounded">{player.positions.join('/')}</span>
                      )}
                    </td>
                    <td className="text-center px-2 py-1.5 text-slate-500 dark:text-[#7a7a7a] font-mono">{player.jersey_number ?? '—'}</td>
                    {FIELDS.map(field => (
                      <td key={field} className="stats-cell text-center px-1 py-1">
                        {readOnly ? (
                          <span className="font-semibold">{st[field] ?? 0}</span>
                        ) : (
                          <input type="number" value={getStat(player.id, field) || ''} placeholder="0"
                            onChange={e => setStat(player.id, field, Number(e.target.value) || 0)}
                            className="w-12 text-center bg-transparent border-0 text-slate-900 dark:text-white text-xs focus:outline-none py-1 px-1 rounded hover:bg-black/[0.04] dark:hover:bg-white/5" />
                        )}
                      </td>
                    ))}
                    <td className="text-center px-2 py-1.5 font-semibold text-slate-400 dark:text-[#5a5a5a] border-l-2 border-black/[0.12] dark:border-white/[0.08] bg-black/[0.025] dark:bg-white/[0.025]">{pts(st)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
