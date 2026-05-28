'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Player, Team } from '@/lib/supabase/types'
import { calcYPA, calcYPC, calcYPR, calcCompPct } from '@/lib/utils'

type Game = { id: string; home_score: number | null; away_score: number | null; status: string; home_team: Team; away_team: Team }
type StatRow = Record<string, number>
type AllStats = Record<string, Record<string, StatRow>> // [quarter][playerId] = stats

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'OT']

const QB_FIELDS = ['pass_yards','pass_completions','pass_attempts','pass_tds','interceptions_thrown','qb_rush_yards','qb_rush_tds'] as const
const RB_FIELDS = ['rush_carries','rush_yards','rush_tds','rb_rec_yards','rb_receptions','rb_targets','rb_fumbles'] as const
const REC_FIELDS = ['rec_yards','receptions','rec_targets','rec_tds','rec_fumbles'] as const
const DEF_FIELDS = ['sacks','def_interceptions'] as const
const K_FIELDS = ['fg_made','fg_attempts','ep_made','ep_attempts'] as const

const QB_HEADERS = ['Pass YDS','Comp','Att','Pass TD','INT','Rush YDS','Rush TD']
const RB_HEADERS = ['Carries','Rush YDS','Rush TD','Rec YDS','Rec','Tar','Fumbles']
const REC_HEADERS = ['Rec YDS','Rec','Tar','Rec TD','Fumbles']
const DEF_HEADERS = ['Sacks','INT']
const K_HEADERS = ['FGM','FGA','EPM','EPA']

function getPositionFields(pos: string[]): { fields: readonly string[]; headers: string[] } {
  if (pos.includes('QB')) return { fields: QB_FIELDS, headers: QB_HEADERS }
  if (pos.includes('RB')) return { fields: RB_FIELDS, headers: RB_HEADERS }
  if (pos.some(p => ['WR','TE'].includes(p))) return { fields: REC_FIELDS, headers: REC_HEADERS }
  if (pos.some(p => ['K','P'].includes(p))) return { fields: K_FIELDS, headers: K_HEADERS }
  return { fields: DEF_FIELDS, headers: DEF_HEADERS }
}

function calcTeamScore(stats: AllStats, players: Player[]): number {
  let score = 0
  players.forEach(p => {
    QUARTERS.forEach(q => {
      const s = stats[q]?.[p.id] ?? {}
      const pos = p.positions as string[]
      if (pos.includes('QB')) score += ((s.pass_tds ?? 0) + (s.qb_rush_tds ?? 0)) * 6
      else if (pos.includes('RB')) score += (s.rush_tds ?? 0) * 6
      // WR/TE rec_tds = selbe TDs wie QB pass_tds → nicht nochmal zählen
      else if (pos.some((pp: string) => ['K','P'].includes(pp))) score += (s.fg_made ?? 0) * 3 + (s.ep_made ?? 0)
    })
  })
  return score
}

function calcTotals(allStats: AllStats, playerId: string) {
  const totals: StatRow = {}
  QUARTERS.forEach(q => {
    const qs = allStats[q]?.[playerId] ?? {}
    Object.entries(qs).forEach(([k, v]) => {
      totals[k] = (totals[k] ?? 0) + (typeof v === 'number' ? v : 0)
    })
  })
  return totals
}

function teamTotals(allStats: AllStats, players: Player[], quarter: string) {
  let totalYds = 0, totalTDs = 0, totalINTs = 0, totalFumbles = 0, totalPoints = 0
  players.forEach(p => {
    const qs = (quarter === 'Total'
      ? QUARTERS.reduce((acc, q) => ({ ...acc, ...Object.fromEntries(Object.entries(allStats[q]?.[p.id] ?? {}).map(([k, v]) => [k, (acc[k] ?? 0) + (v ?? 0)])) }), {} as StatRow)
      : allStats[quarter]?.[p.id]) ?? {}
    const pos = p.positions

    if (pos.includes('QB')) {
      totalYds   += (qs.pass_yards ?? 0) + (qs.qb_rush_yards ?? 0)
      totalTDs   += (qs.pass_tds  ?? 0) + (qs.qb_rush_tds  ?? 0)
      totalINTs  += qs.interceptions_thrown ?? 0
    } else if (pos.includes('RB')) {
      totalYds   += qs.rush_yards ?? 0            // rb_rec_yards weggelassen – selbe Yards wie QB pass_yards
      totalTDs   += qs.rush_tds   ?? 0
      totalFumbles += qs.rb_fumbles ?? 0
    } else if (pos.some(pp => ['WR','TE'].includes(pp))) {
      // rec_yards = selbe Yards wie QB pass_yards; rec_tds = selbe TDs wie QB pass_tds → beide weglassen
      totalFumbles += qs.rec_fumbles ?? 0
    } else if (pos.some(pp => ['K','P'].includes(pp))) {
      totalPoints += (qs.fg_made ?? 0) * 3 + (qs.ep_made ?? 0)
    }
  })
  totalPoints += totalTDs * 6   // einmal nach der Schleife, nicht bei jedem Spieler
  return { totalYds, totalTDs, totalINTs, totalFumbles, totalPoints }
}

export default function StatsTracker({ game, homePlayers, awayPlayers, initialStats }: {
  game: Game; homePlayers: Player[]; awayPlayers: Player[]; initialStats: any[]
}) {
  const supabase = createClient()
  const [quarter, setQuarter] = useState('Q1')
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home')
  const [allStats, setAllStats] = useState<AllStats>(() => {
    const s: AllStats = {}
    QUARTERS.forEach(q => { s[q] = {} })
    initialStats.forEach(st => {
      if (!s[st.quarter]) s[st.quarter] = {}
      s[st.quarter][st.player_id] = st
    })
    return s
  })
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [homeScore, setHomeScore] = useState(game.home_score ?? 0)
  const [awayScore, setAwayScore] = useState(game.away_score ?? 0)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const scoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-calculate score from TDs and kicker stats
  useEffect(() => {
    const newHome = calcTeamScore(allStats, homePlayers)
    const newAway = calcTeamScore(allStats, awayPlayers)
    setHomeScore(newHome)
    setAwayScore(newAway)
    if (scoreTimer.current) clearTimeout(scoreTimer.current)
    scoreTimer.current = setTimeout(async () => {
      await supabase.from('games').update({ home_score: newHome, away_score: newAway }).eq('id', game.id)
    }, 1000)
  }, [allStats])

  const activePlayers = activeTeam === 'home' ? homePlayers : awayPlayers
  const activeTeamData = activeTeam === 'home' ? game.home_team : game.away_team

  const getStat = (playerId: string, field: string, q = quarter) =>
    allStats[q]?.[playerId]?.[field] ?? 0

  const setStat = useCallback((playerId: string, field: string, value: number) => {
    setAllStats(prev => {
      const next = { ...prev }
      if (!next[quarter]) next[quarter] = {}
      if (!next[quarter][playerId]) next[quarter][playerId] = {}
      next[quarter][playerId] = { ...next[quarter][playerId], [field]: value }
      return next
    })

    const key = `${quarter}-${playerId}`
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key])
    setSaving(s => ({ ...s, [key]: true }))
    saveTimers.current[key] = setTimeout(() => {
      persistStat(playerId, field, value)
    }, 800)
  }, [quarter])

  async function persistStat(playerId: string, _field: string, _value: number) {
    const player = [...homePlayers, ...awayPlayers].find(p => p.id === playerId)
    if (!player) return
    const teamId = player.team_id!
    const stats = allStats[quarter]?.[playerId] ?? {}
    const key = `${quarter}-${playerId}`

    const { error } = await supabase.from('game_stats').upsert({
      game_id: game.id,
      player_id: playerId,
      team_id: teamId,
      quarter,
      ...stats,
    }, { onConflict: 'game_id,player_id,quarter' })

    setSaving(s => { const n = { ...s }; delete n[key]; return n })
  }

  async function updateScore() {
    await supabase.from('games').update({ home_score: homeScore, away_score: awayScore }).eq('id', game.id)
  }

  async function finalizeGame() {
    if (!confirm('Finalize game and transfer stats to career database?')) return
    // Update game status
    await supabase.from('games').update({ status: 'final', home_score: homeScore, away_score: awayScore }).eq('id', game.id)

    // Transfer stats to career_stats for each player
    const allPlayers = [...homePlayers, ...awayPlayers]
    for (const player of allPlayers) {
      const totals: StatRow = {}
      QUARTERS.forEach(q => {
        Object.entries(allStats[q]?.[player.id] ?? {}).forEach(([k, v]) => {
          if (typeof v === 'number') totals[k] = (totals[k] ?? 0) + v
        })
      })
      if (Object.keys(totals).length === 0) continue

      const existing = await supabase.from('career_stats').select('*').eq('player_id', player.id).eq('season', 2026).single()
      if (existing.data) {
        const merged: StatRow = {}
        const keys = Object.keys(totals)
        keys.forEach(k => { merged[k] = (existing.data[k] ?? 0) + (totals[k] ?? 0) })
        await supabase.from('career_stats').update({ ...merged, games_played: (existing.data.games_played ?? 0) + 1 }).eq('id', existing.data.id)
      } else {
        await supabase.from('career_stats').insert({ player_id: player.id, season: 2026, games_played: 1, ...totals })
      }
    }
    alert('Game finalized! Stats transferred to career database.')
  }

  const homeTotals = teamTotals(allStats, homePlayers, quarter === 'Total' ? 'Total' : quarter)
  const awayTotals = teamTotals(allStats, awayPlayers, quarter === 'Total' ? 'Total' : quarter)

  return (
    <div className="max-h-screen flex flex-col bg-[#0a0a0a]">
      {/* Top bar */}
      <div className="bg-[#111] border-b border-white/10 px-4 py-2 flex items-center gap-4 shrink-0">
        <Link href="/admin/games" className="text-xs text-[#7a7a7a] hover:text-white">← Games</Link>
        <div className="font-bold text-sm">
          <span style={{ color: game.home_team.primary_color }}>{game.home_team.short_name}</span>
          <span className="text-[#7a7a7a] mx-2">vs</span>
          <span style={{ color: game.away_team.primary_color }}>{game.away_team.short_name}</span>
        </div>

        {/* Score inputs — auto-calculated from stats, manually editable for safeties/2pt */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <input value={homeScore} onChange={e => { setHomeScore(Number(e.target.value)) }} onBlur={updateScore}
              type="number" className="w-12 bg-[#0a0a0a] border border-white/10 rounded px-2 py-1 text-white text-center text-sm focus:outline-none focus:border-[#ff1d25]" />
            <span className="text-[10px] text-[#ff1d25] leading-none mt-0.5">auto</span>
          </div>
          <span className="text-[#7a7a7a]">–</span>
          <div className="flex flex-col items-center">
            <input value={awayScore} onChange={e => { setAwayScore(Number(e.target.value)) }} onBlur={updateScore}
              type="number" className="w-12 bg-[#0a0a0a] border border-white/10 rounded px-2 py-1 text-white text-center text-sm focus:outline-none focus:border-[#ff1d25]" />
            <span className="text-[10px] text-[#ff1d25] leading-none mt-0.5">auto</span>
          </div>
        </div>

        {/* Quarter tabs */}
        <div className="flex gap-1 ml-2">
          {[...QUARTERS, 'Total'].map(q => (
            <button key={q} onClick={() => setQuarter(q)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${quarter === q ? 'bg-[#ff1d25] text-white' : 'text-[#7a7a7a] hover:text-white bg-[#1a1a1a]'}`}>
              {q}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {Object.keys(saving).length > 0 && <span className="text-xs text-[#7a7a7a] animate-pulse">Saving...</span>}
          <button onClick={finalizeGame}
            className="text-xs border border-[#04a550]/40 text-[#04a550] hover:bg-[#04a550]/10 px-3 py-1.5 rounded transition-colors font-medium">
            Finalize & Transfer Stats
          </button>
        </div>
      </div>

      {/* Team selector + team totals */}
      <div className="bg-[#111] border-b border-white/5 px-4 py-2 flex items-center gap-6 shrink-0">
        <div className="flex gap-1">
          {['home', 'away'].map(side => {
            const t = side === 'home' ? game.home_team : game.away_team
            return (
              <button key={side} onClick={() => setActiveTeam(side as 'home' | 'away')}
                style={activeTeam === side ? { borderColor: t.primary_color, color: t.primary_color } : {}}
                className={`px-4 py-1.5 rounded text-sm font-bold transition-colors border ${
                  activeTeam === side ? 'bg-white/5' : 'border-transparent text-[#7a7a7a] hover:text-white'
                }`}>
                {t.short_name}
              </button>
            )
          })}
        </div>

        {/* Team stat summary */}
        <div className="flex items-center gap-6 text-xs text-[#7a7a7a]">
          {(() => {
            const t = activeTeam === 'home' ? homeTotals : awayTotals
            return <>
              <span>YDS: <strong className="text-white">{t.totalYds}</strong></span>
              <span>TDs: <strong className="text-[#04a550]">{t.totalTDs}</strong></span>
              <span>INTs: <strong className="text-[#ff1d25]">{t.totalINTs}</strong></span>
              <span>Fumbles: <strong className="text-[#7a7a7a]">{t.totalFumbles}</strong></span>
            </>
          })()}
        </div>
      </div>

      {/* Stats Table */}
      <div className="flex-1 overflow-auto">
        <StatsTable
          players={activePlayers}
          allStats={allStats}
          quarter={quarter}
          getStat={getStat}
          setStat={setStat}
          calcTotals={calcTotals}
          readOnly={quarter === 'Total'}
          teamColor={activeTeamData?.primary_color}
        />
      </div>
    </div>
  )
}

function StatsTable({ players, allStats, quarter, getStat, setStat, calcTotals, readOnly, teamColor }: {
  players: Player[]; allStats: AllStats; quarter: string; getStat: (pid: string, f: string, q?: string) => number
  setStat: (pid: string, f: string, v: number) => void; calcTotals: (s: AllStats, pid: string) => StatRow
  readOnly: boolean; teamColor?: string
}) {
  if (players.length === 0) return (
    <div className="p-8 text-center text-[#7a7a7a] text-sm">No players found for this team.</div>
  )

  const posGroups: Record<string, Player[]> = {}
  players.forEach(p => {
    const pos = p.positions[0] ?? 'DEF'
    if (!posGroups[pos]) posGroups[pos] = []
    posGroups[pos].push(p)
  })

  return (
    <table className="w-full text-xs border-collapse">
      <tbody>
        {Object.entries(posGroups).map(([pos, posPlayers]) => {
          const { fields, headers } = getPositionFields(posPlayers[0]?.positions ?? [])
          return (
            <>
              {/* Position group header */}
              <tr key={`header-${pos}`} className="bg-[#1a1a1a] sticky top-0 z-10">
                <th className="text-left px-3 py-1.5 text-[#7a7a7a] font-semibold uppercase tracking-wider border-b border-white/10 w-32">
                  <span style={{ color: teamColor }}>{pos}</span>
                </th>
                <th className="px-2 py-1.5 text-[#7a7a7a] border-b border-white/10 w-8">#</th>
                {headers.map(h => (
                  <th key={h} className="text-center px-2 py-1.5 text-[#7a7a7a] font-medium border-b border-white/10 min-w-[56px]">{h}</th>
                ))}
                {/* Auto-calculated columns */}
                {pos === 'QB' && <><th className="text-center px-2 py-1.5 text-[#5a5a5a] border-b border-white/10 min-w-[52px]">Total YDS</th><th className="text-center px-2 py-1.5 text-[#5a5a5a] border-b border-white/10 min-w-[48px]">Total TD</th><th className="text-center px-2 py-1.5 text-[#5a5a5a] border-b border-white/10 min-w-[48px]">YPA</th><th className="text-center px-2 py-1.5 text-[#5a5a5a] border-b border-white/10 min-w-[52px]">Comp%</th></>}
                {pos === 'RB' && <><th className="text-center px-2 py-1.5 text-[#5a5a5a] border-b border-white/10 min-w-[48px]">YPC</th></>}
                {['WR','TE'].includes(pos) && <><th className="text-center px-2 py-1.5 text-[#5a5a5a] border-b border-white/10 min-w-[48px]">YPR</th></>}
                {['K','P'].includes(pos) && <><th className="text-center px-2 py-1.5 text-[#5a5a5a] border-b border-white/10 min-w-[48px]">PTS</th></>}
              </tr>

              {posPlayers.map(player => {
                const st = readOnly ? calcTotals(allStats, player.id) : {}
                const getV = (field: string) => readOnly ? (st[field] ?? 0) : getStat(player.id, field)

                return (
                  <tr key={player.id} className="border-b border-white/5 hover:bg-white/[0.02] group">
                    <td className="px-3 py-1.5 font-medium whitespace-nowrap">
                      {player.first_name[0]}. {player.last_name}
                    </td>
                    <td className="text-center px-2 py-1.5 text-[#7a7a7a] font-mono">{player.jersey_number ?? '—'}</td>
                    {fields.map(field => (
                      <td key={field} className="stats-cell text-center px-1 py-1">
                        {readOnly ? (
                          <span className="font-semibold">{getV(field as string)}</span>
                        ) : (
                          <input
                            type="number" min="0" step={field === 'sacks' ? '0.5' : '1'}
                            value={getStat(player.id, field as string) || ''}
                            placeholder="0"
                            onChange={e => setStat(player.id, field as string, Number(e.target.value) || 0)}
                            className="w-14 text-center bg-transparent border-0 text-white text-xs focus:outline-none py-1 px-1 rounded hover:bg-white/5"
                          />
                        )}
                      </td>
                    ))}
                    {/* Auto-calculated */}
                    {pos === 'QB' && <>
                      <td className="text-center px-2 py-1.5 text-[#5a5a5a] font-semibold">{getV('pass_yards') + getV('qb_rush_yards')}</td>
                      <td className="text-center px-2 py-1.5 text-[#5a5a5a] font-semibold">{getV('pass_tds') + getV('qb_rush_tds')}</td>
                      <td className="text-center px-2 py-1.5 text-[#5a5a5a]">{calcYPA(getV('pass_yards'), getV('pass_attempts'))}</td>
                      <td className="text-center px-2 py-1.5 text-[#5a5a5a]">{calcCompPct(getV('pass_completions'), getV('pass_attempts'))}</td>
                    </>}
                    {pos === 'RB' && <td className="text-center px-2 py-1.5 text-[#5a5a5a]">{calcYPC(getV('rush_yards'), getV('rush_carries'))}</td>}
                    {['WR','TE'].includes(pos) && <td className="text-center px-2 py-1.5 text-[#5a5a5a]">{calcYPR(getV('rec_yards'), getV('receptions'))}</td>}
                    {['K','P'].includes(pos) && <td className="text-center px-2 py-1.5 text-[#5a5a5a] font-semibold">{getV('fg_made') * 3 + getV('ep_made')}</td>}
                  </tr>
                )
              })}
            </>
          )
        })}
      </tbody>
    </table>
  )
}
