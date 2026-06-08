'use client'
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Player, Team } from '@/lib/supabase/types'
import { calcYPA, calcYPC, calcYPR, calcCompPct } from '@/lib/utils'

type Game = { id: string; season: number; home_score: number | null; away_score: number | null; status: string; home_team: Team; away_team: Team }
type StatRow = Record<string, number>
type AllStats = Record<string, Record<string, StatRow>> // [quarter][playerId] = stats

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'OT']

const QB_FIELDS = ['pass_yards','pass_completions','pass_attempts','pass_tds','interceptions_thrown','qb_rush_yards','rush_carries','qb_rush_tds','qb_fumbles'] as const
const RB_FIELDS = ['rush_carries','rush_yards','rush_tds','rb_rec_yards','rb_receptions','rb_targets','rb_fumbles'] as const
const REC_FIELDS = ['rec_yards','receptions','rec_targets','rec_tds','rec_fumbles'] as const
const DEF_FIELDS = ['def_tackles','sacks','def_interceptions','def_fumble_recovered'] as const
const K_FIELDS = ['fg_made','fg_attempts','ep_made','ep_attempts'] as const

const QB_HEADERS = ['Pass YDS','Comp','Att','Pass TD','INT','Rush YDS','Carries','Rush TD','Fumbles']
const RB_HEADERS = ['Carries','Rush YDS','Rush TD','Rec YDS','Rec','Tar','Fumbles']
const REC_HEADERS = ['Rec YDS','Rec','Tar','Rec TD','Fumbles']
const DEF_HEADERS = ['Tackles','Sacks','INT','Fum Rec']
const K_HEADERS = ['FGM','FGA','EPM','EPA']

/**
 * Ensure a team colour is legible on the dark UI backgrounds (#0a0a0a – #1a1a1a).
 * Very dark colours (e.g. TU's #000000) are blended toward white so they stay
 * visible without losing their hue. Colours already bright enough are returned
 * unchanged.
 */
function darkSafe(hex?: string | null): string {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return '#ff1d25'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  // Perceived luminance (0 = black, 1 = white)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (lum >= 0.22) return hex            // already readable on dark bg
  // Blend toward white — keeps the hue, lifts the brightness
  const t = 0.65
  const nr = Math.round(r + (255 - r) * t)
  const ng = Math.round(g + (255 - g) * t)
  const nb = Math.round(b + (255 - b) * t)
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
}

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
      // K/P als separates if (nicht else if) — Dual-Position-Spieler wie RB/K zählen hier auch
      if (pos.some((pp: string) => ['K','P'].includes(pp))) score += (s.fg_made ?? 0) * 3 + (s.ep_made ?? 0)
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
  let totalPassYds = 0, totalRushYds = 0, totalRecYds = 0
  let totalTDs = 0, totalINTs = 0, totalFumbles = 0, totalPoints = 0
  let totalTargets = 0, totalReceptions = 0
  let totalFGM = 0, totalFGA = 0, totalEPM = 0, totalEPA = 0
  players.forEach(p => {
    const qs = (quarter === 'Total'
      ? QUARTERS.reduce((acc, q) => ({ ...acc, ...Object.fromEntries(Object.entries(allStats[q]?.[p.id] ?? {}).map(([k, v]) => [k, (acc[k] ?? 0) + (v ?? 0)])) }), {} as StatRow)
      : allStats[quarter]?.[p.id]) ?? {}
    const pos = p.positions

    if (pos.includes('QB')) {
      totalPassYds += qs.pass_yards     ?? 0
      totalRushYds += qs.qb_rush_yards  ?? 0
      totalTDs     += (qs.pass_tds ?? 0) + (qs.qb_rush_tds ?? 0)
      totalINTs    += qs.interceptions_thrown ?? 0
    } else if (pos.includes('RB')) {
      totalRushYds    += qs.rush_yards    ?? 0
      totalRecYds     += qs.rb_rec_yards  ?? 0
      totalTDs        += qs.rush_tds      ?? 0
      totalFumbles    += qs.rb_fumbles    ?? 0
      totalTargets    += qs.rb_targets    ?? 0
      totalReceptions += qs.rb_receptions ?? 0
    } else if (pos.some(pp => ['WR','TE'].includes(pp))) {
      totalRecYds     += qs.rec_yards     ?? 0
      totalFumbles    += qs.rec_fumbles   ?? 0
      totalTargets    += qs.rec_targets   ?? 0
      totalReceptions += qs.receptions    ?? 0
    }
    // K/P als separates if — zählt auch bei Dual-Position-Spielern (RB/K, DB/K usw.)
    if (pos.some(pp => ['K','P'].includes(pp))) {
      totalFGM += qs.fg_made      ?? 0
      totalFGA += qs.fg_attempts  ?? 0
      totalEPM += qs.ep_made      ?? 0
      totalEPA += qs.ep_attempts  ?? 0
    }
  })
  totalPoints += totalTDs * 6 + totalFGM * 3 + totalEPM
  const totalYds = totalPassYds + totalRushYds
  const catchPct = totalTargets > 0 ? Math.round(totalReceptions / totalTargets * 100) : 0
  return { totalYds, totalPassYds, totalRushYds, totalRecYds, totalTDs, totalINTs, totalFumbles, totalPoints, totalTargets, totalReceptions, catchPct, totalFGM, totalFGA, totalEPM, totalEPA }
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

      const existing = await supabase.from('career_stats').select('*').eq('player_id', player.id).eq('season', game.season).single()
      if (existing.data) {
        const merged: StatRow = {}
        const keys = Object.keys(totals)
        keys.forEach(k => { merged[k] = (existing.data[k] ?? 0) + (totals[k] ?? 0) })
        await supabase.from('career_stats').update({ ...merged, games_played: (existing.data.games_played ?? 0) + 1 }).eq('id', existing.data.id)
      } else {
        await supabase.from('career_stats').insert({ player_id: player.id, season: game.season, games_played: 1, ...totals })
      }
    }
    alert('Game finalized! Stats transferred to career database.')
  }

  const homeTotals = teamTotals(allStats, homePlayers, quarter === 'Total' ? 'Total' : quarter)
  const awayTotals = teamTotals(allStats, awayPlayers, quarter === 'Total' ? 'Total' : quarter)

  return (
    <div className="max-h-screen flex flex-col bg-[#f7f8fa] dark:bg-[#0a0a0a]">
      {/* Top bar */}
      <div className="bg-white dark:bg-[#111] border-b border-black/10 dark:border-white/10 px-4 py-2 flex items-center gap-4 shrink-0">
        <Link href="/admin/games" className="text-xs text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">← Games</Link>
        <div className="font-bold text-sm">
          <span style={{ color: darkSafe(game.home_team.primary_color) }}>{game.home_team.short_name}</span>
          <span className="text-slate-400 dark:text-[#7a7a7a] mx-2">vs</span>
          <span style={{ color: darkSafe(game.away_team.primary_color) }}>{game.away_team.short_name}</span>
        </div>

        {/* Score inputs — auto-calculated from stats, manually editable for safeties/2pt */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <input value={homeScore} onChange={e => { setHomeScore(Number(e.target.value)) }} onBlur={updateScore}
              type="number" className="w-12 bg-[#f7f8fa] dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 rounded px-2 py-1 text-slate-900 dark:text-white text-center text-sm focus:outline-none focus:border-[#ff1d25]" />
            <span className="text-[10px] text-[#ff1d25] leading-none mt-0.5">auto</span>
          </div>
          <span className="text-slate-400 dark:text-[#7a7a7a]">–</span>
          <div className="flex flex-col items-center">
            <input value={awayScore} onChange={e => { setAwayScore(Number(e.target.value)) }} onBlur={updateScore}
              type="number" className="w-12 bg-[#f7f8fa] dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 rounded px-2 py-1 text-slate-900 dark:text-white text-center text-sm focus:outline-none focus:border-[#ff1d25]" />
            <span className="text-[10px] text-[#ff1d25] leading-none mt-0.5">auto</span>
          </div>
        </div>

        {/* Quarter tabs */}
        <div className="flex gap-1 ml-2">
          {[...QUARTERS, 'Total'].map(q => (
            <button key={q} onClick={() => setQuarter(q)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${quarter === q ? 'bg-[#ff1d25] text-white' : 'text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white bg-[#f1f5f9] dark:bg-[#1a1a1a]'}`}>
              {q}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {Object.keys(saving).length > 0 && <span className="text-xs text-slate-500 dark:text-[#7a7a7a] animate-pulse">Saving...</span>}
          <button onClick={finalizeGame}
            className="text-xs border border-[#04a550]/40 text-[#04a550] hover:bg-[#04a550]/10 px-3 py-1.5 rounded transition-colors font-medium">
            Finalize & Transfer Stats
          </button>
        </div>
      </div>

      {/* Team selector + team totals */}
      <div className="bg-white dark:bg-[#111] border-b border-black/[0.07] dark:border-white/5 px-4 py-2 flex items-center gap-6 shrink-0">
        <div className="flex gap-1">
          {['home', 'away'].map(side => {
            const t = side === 'home' ? game.home_team : game.away_team
            return (
              <button key={side} onClick={() => setActiveTeam(side as 'home' | 'away')}
                style={activeTeam === side ? { borderColor: darkSafe(t.primary_color), color: darkSafe(t.primary_color) } : {}}
                className={`px-4 py-1.5 rounded text-sm font-bold transition-colors border ${
                  activeTeam === side ? 'bg-black/[0.04] dark:bg-white/5' : 'border-transparent text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white'
                }`}>
                {t.short_name}
              </button>
            )
          })}
        </div>

        {/* Team stat summary */}
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-[#7a7a7a] flex-wrap">
          {(() => {
            const t = activeTeam === 'home' ? homeTotals : awayTotals
            return <>
              {/* Yardage breakdown */}
              <span>PASS: <strong className="text-slate-900 dark:text-white">{t.totalPassYds}</strong></span>
              <span className="text-black/10 dark:text-white/10">|</span>
              <span>RUSH: <strong className="text-slate-900 dark:text-white">{t.totalRushYds}</strong></span>
              <span className="text-black/10 dark:text-white/10">|</span>
              <span>REC: <strong className="text-slate-900 dark:text-white">{t.totalRecYds}</strong></span>
              <span className="text-black/10 dark:text-white/10">|</span>
              <span>TOTAL: <strong className="text-slate-900 dark:text-white">{t.totalYds}</strong></span>
              <span className="text-black/10 dark:text-white/10">|</span>
              {/* Catches / targets */}
              <span>REC/TAR: <strong className="text-slate-900 dark:text-white">{t.totalReceptions}/{t.totalTargets}</strong>
                {t.totalTargets > 0 && <span className="text-slate-500 dark:text-[#7a7a7a]"> ({t.catchPct}%)</span>}
              </span>
              <span className="text-black/10 dark:text-white/10">|</span>
              {/* Scores / turnover */}
              <span>TDs: <strong className="text-[#04a550]">{t.totalTDs}</strong></span>
              <span>FG: <strong className="text-slate-900 dark:text-white">{t.totalFGM}/{t.totalFGA}</strong></span>
              <span>EP: <strong className="text-slate-900 dark:text-white">{t.totalEPM}/{t.totalEPA}</strong></span>
              <span>INTs: <strong className="text-[#ff1d25]">{t.totalINTs}</strong></span>
              <span>FUM: <strong className="text-slate-500 dark:text-[#7a7a7a]">{t.totalFumbles}</strong></span>
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
          teamColor={darkSafe(activeTeamData?.primary_color)}
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
    <div className="p-8 text-center text-slate-500 dark:text-[#7a7a7a] text-sm">No players found for this team.</div>
  )

  // Standard-Positionsgruppen (nur Spieler ohne K/P als Primärposition)
  const posGroups: Record<string, Player[]> = {}
  players.forEach(p => {
    const primaryPos = p.positions[0] ?? 'DEF'
    // Reine Kicker/Punter kommen nur in den Kicker-Abschnitt unten; OL hat keine Stats
    if (['K', 'P', 'OL'].includes(primaryPos)) return
    if (!posGroups[primaryPos]) posGroups[primaryPos] = []
    posGroups[primaryPos].push(p)
  })

  // Kicker-Abschnitt: alle Spieler mit K oder P irgendwo in ihren Positionen
  // (reine K/P-Spieler UND Dual-Position wie RB/K, DB/K etc.)
  const kickerPlayers = players.filter(p =>
    p.positions.some((pp: string) => ['K', 'P'].includes(pp))
  )

  function renderPlayerRow(player: Player, fields: readonly string[], pos: string) {
    const st = readOnly ? calcTotals(allStats, player.id) : {}
    const getV = (field: string) => readOnly ? (st[field] ?? 0) : getStat(player.id, field)
    return (
      <tr key={`${player.id}-${pos}`} className="border-b border-black/[0.05] dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
        <td className="px-3 py-1.5 font-medium whitespace-nowrap">
          {player.first_name[0]}. {player.last_name}
          {/* Badge für Dual-Position-Kicker */}
          {pos === 'K/P' && !['K','P'].includes(player.positions[0] ?? '') && (
            <span className="ml-1.5 text-[9px] text-slate-500 dark:text-[#7a7a7a] bg-black/[0.06] dark:bg-white/5 px-1 py-0.5 rounded">
              {player.positions[0]}
            </span>
          )}
        </td>
        <td className="text-center px-2 py-1.5 text-slate-500 dark:text-[#7a7a7a] font-mono">{player.jersey_number ?? '—'}</td>
        {fields.map((field, i) => (
          <td key={field} className={`stats-cell text-center px-1 py-1${pos === 'QB' && i === 5 ? ' border-l-2 border-l-black/20 dark:border-l-white/[0.1]' : ''}`}>
            {readOnly ? (
              <span className="font-semibold">{getV(field as string)}</span>
            ) : (
              <input
                type="number" step={field === 'sacks' ? '0.5' : '1'}
                value={getStat(player.id, field as string) || ''}
                placeholder="0"
                onChange={e => setStat(player.id, field as string, Number(e.target.value) || 0)}
                className="w-14 text-center bg-transparent border-0 text-slate-900 dark:text-white text-xs focus:outline-none py-1 px-1 rounded hover:bg-black/[0.04] dark:hover:bg-white/5"
              />
            )}
          </td>
        ))}
        {/* Auto-calculated — separated with left border + tinted bg */}
        {pos === 'QB' && <>
          <td className="text-center px-2 py-1.5 text-slate-400 dark:text-[#5a5a5a] font-semibold border-l-2 border-black/[0.12] dark:border-white/[0.08] bg-black/[0.025] dark:bg-white/[0.025]">{getV('pass_yards') + getV('qb_rush_yards')}</td>
          <td className="text-center px-2 py-1.5 text-slate-400 dark:text-[#5a5a5a] font-semibold bg-black/[0.025] dark:bg-white/[0.025]">{getV('pass_tds') + getV('qb_rush_tds')}</td>
          <td className="text-center px-2 py-1.5 text-slate-400 dark:text-[#5a5a5a] bg-black/[0.025] dark:bg-white/[0.025]">{calcYPC(getV('pass_yards'), getV('pass_completions'))}</td>
          <td className="text-center px-2 py-1.5 text-slate-400 dark:text-[#5a5a5a] bg-black/[0.025] dark:bg-white/[0.025]">{calcCompPct(getV('pass_completions'), getV('pass_attempts'))}</td>
        </>}
        {pos === 'RB' && <td className="text-center px-2 py-1.5 text-slate-400 dark:text-[#5a5a5a] border-l-2 border-black/[0.12] dark:border-white/[0.08] bg-black/[0.025] dark:bg-white/[0.025]">{calcYPC(getV('rush_yards'), getV('rush_carries'))}</td>}
        {['WR','TE'].includes(pos) && <td className="text-center px-2 py-1.5 text-slate-400 dark:text-[#5a5a5a] border-l-2 border-black/[0.12] dark:border-white/[0.08] bg-black/[0.025] dark:bg-white/[0.025]">{calcYPR(getV('rec_yards'), getV('receptions'))}</td>}
        {pos === 'K/P' && <td className="text-center px-2 py-1.5 text-slate-400 dark:text-[#5a5a5a] font-semibold border-l-2 border-black/[0.12] dark:border-white/[0.08] bg-black/[0.025] dark:bg-white/[0.025]">{getV('fg_made') * 3 + getV('ep_made')}</td>}
      </tr>
    )
  }

  // Feste Anzeigereihenfolge: Offense → K/P → Defense
  const OFFENSE_ORDER = ['QB', 'RB', 'WR', 'TE']
  const DEFENSE_ORDER = ['DB', 'DL', 'LB']
  // Alles was nicht explizit eingeordnet ist kommt ganz am Ende
  const OTHER_KEYS = Object.keys(posGroups).filter(
    p => !OFFENSE_ORDER.includes(p) && !DEFENSE_ORDER.includes(p)
  )

  function renderGroup(pos: string) {
    const posPlayers = posGroups[pos]
    if (!posPlayers?.length) return null
    const nonKickerPos = (posPlayers[0]?.positions ?? []).filter((pp: string) => !['K', 'P'].includes(pp))
    const { fields, headers } = getPositionFields(nonKickerPos)
    return (
      <React.Fragment key={pos}>
        <tr className="bg-[#f1f5f9] dark:bg-[#1a1a1a] sticky top-0 z-10">
          <th className="text-left px-3 py-1.5 text-slate-500 dark:text-[#7a7a7a] font-semibold uppercase tracking-wider border-b border-black/10 dark:border-white/10 w-32">
            <span style={{ color: teamColor }}>{pos}</span>
          </th>
          <th className="px-2 py-1.5 text-slate-500 dark:text-[#7a7a7a] border-b border-black/10 dark:border-white/10 w-8">#</th>
          {headers.map((h, i) => (
            <th key={h} className={`text-center px-2 py-1.5 text-slate-500 dark:text-[#7a7a7a] font-medium border-b border-black/10 dark:border-white/10 min-w-[56px]${pos === 'QB' && i === 5 ? ' border-l-2 border-l-black/25 dark:border-l-white/[0.15]' : ''}`}>{h}</th>
          ))}
          {pos === 'QB' && <><th className="text-center px-2 py-1.5 italic text-slate-400 dark:text-[#4a4a4a] border-b border-l-2 border-black/10 dark:border-white/10 border-l-black/20 dark:border-l-white/[0.12] bg-black/[0.025] dark:bg-white/[0.03] min-w-[52px]">Total YDS</th><th className="text-center px-2 py-1.5 italic text-slate-400 dark:text-[#4a4a4a] border-b border-black/10 dark:border-white/10 bg-black/[0.025] dark:bg-white/[0.03] min-w-[48px]">Total TD</th><th className="text-center px-2 py-1.5 italic text-slate-400 dark:text-[#4a4a4a] border-b border-black/10 dark:border-white/10 bg-black/[0.025] dark:bg-white/[0.03] min-w-[48px]">Y/Comp</th><th className="text-center px-2 py-1.5 italic text-slate-400 dark:text-[#4a4a4a] border-b border-black/10 dark:border-white/10 bg-black/[0.025] dark:bg-white/[0.03] min-w-[52px]">Comp%</th></>}
          {pos === 'RB' && <th className="text-center px-2 py-1.5 italic text-slate-400 dark:text-[#4a4a4a] border-b border-l-2 border-black/10 dark:border-white/10 border-l-black/20 dark:border-l-white/[0.12] bg-black/[0.025] dark:bg-white/[0.03] min-w-[48px]">YPC</th>}
          {['WR','TE'].includes(pos) && <th className="text-center px-2 py-1.5 italic text-slate-400 dark:text-[#4a4a4a] border-b border-l-2 border-black/10 dark:border-white/10 border-l-black/20 dark:border-l-white/[0.12] bg-black/[0.025] dark:bg-white/[0.03] min-w-[48px]">YPR</th>}
        </tr>
        {posPlayers.map(p => renderPlayerRow(p, fields, pos))}
      </React.Fragment>
    )
  }

  return (
    <table className="w-full text-xs border-collapse">
      <tbody>
        {/* QB → RB → WR → TE */}
        {OFFENSE_ORDER.map(pos => renderGroup(pos))}

        {/* K / P (zwischen Offense und Defense) */}
        {kickerPlayers.length > 0 && (
          <React.Fragment key="K/P">
            <tr className="bg-[#f1f5f9] dark:bg-[#1a1a1a] sticky top-0 z-10">
              <th className="text-left px-3 py-1.5 font-semibold uppercase tracking-wider border-b border-black/10 dark:border-white/10 w-32">
                <span style={{ color: teamColor }}>K / P</span>
              </th>
              <th className="px-2 py-1.5 text-slate-500 dark:text-[#7a7a7a] border-b border-black/10 dark:border-white/10 w-8">#</th>
              {K_HEADERS.map(h => (
                <th key={h} className="text-center px-2 py-1.5 text-slate-500 dark:text-[#7a7a7a] font-medium border-b border-black/10 dark:border-white/10 min-w-[56px]">{h}</th>
              ))}
              <th className="text-center px-2 py-1.5 italic text-slate-400 dark:text-[#4a4a4a] border-b border-l-2 border-black/10 dark:border-white/10 border-l-black/20 dark:border-l-white/[0.12] bg-black/[0.025] dark:bg-white/[0.03] min-w-[48px]">PTS</th>
            </tr>
            {kickerPlayers.map(p => renderPlayerRow(p, K_FIELDS, 'K/P'))}
          </React.Fragment>
        )}

        {/* DB → DL → LB → OL */}
        {DEFENSE_ORDER.map(pos => renderGroup(pos))}

        {/* Sonstige Positionen die nicht in der definierten Reihenfolge sind */}
        {OTHER_KEYS.map(pos => renderGroup(pos))}
      </tbody>
    </table>
  )
}
