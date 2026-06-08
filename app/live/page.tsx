'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'

export default function LivePage() {
  const [game, setGame] = useState<any>(null)
  const [stats, setStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function fetchLive() {
      const { data: g } = await supabase
        .from('games')
        .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
        .eq('status', 'live')
        .limit(1)
        .maybeSingle()
      setGame(g)

      if (g) {
        const { data: s } = await supabase
          .from('game_stats')
          .select('*, player:players(*)')
          .eq('game_id', g.id)
        setStats(s ?? [])
      }
      setLoading(false)
    }

    fetchLive()

    // Real-time subscription
    const channel = supabase
      .channel('live-game')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, fetchLive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats' }, fetchLive)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-500 dark:text-[#7a7a7a]">Loading...</div>
  )

  if (!game) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-4">📺</div>
      <h1 className="text-2xl font-black mb-2 text-slate-900 dark:text-white">No Live Game</h1>
      <p className="text-slate-500 dark:text-[#7a7a7a]">Check back when a game is in progress.</p>
      <Link href="/schedule" className="mt-4 inline-block text-[#ff1d25] text-sm hover:underline">View Schedule →</Link>
    </div>
  )

  const totals = aggregateStats(stats)
  const homePlayers = totals.filter((s: any) => s.player?.team_id === game.home_team?.id)
  const awayPlayers = totals.filter((s: any) => s.player?.team_id === game.away_team?.id)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Scoreboard */}
      <div className="bg-white dark:bg-[#111] border border-[#ff1d25]/30 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-center gap-1 mb-4">
          <span className="animate-pulse w-2 h-2 rounded-full bg-[#ff1d25] inline-block" />
          <span className="text-[#ff1d25] text-xs font-bold uppercase tracking-widest">Live</span>
        </div>
        <div className="flex items-center justify-center gap-8">
          <div className="text-center flex flex-col items-center gap-2">
            <TeamBadge team={game.home_team} size="lg" />
            <span className="font-bold text-sm text-slate-900 dark:text-white">{game.home_team?.name}</span>
          </div>
          <div className="text-center">
            <div className="text-5xl font-black tabular-nums text-slate-900 dark:text-white">
              {game.home_score ?? 0} <span className="text-slate-400 dark:text-[#7a7a7a]">–</span> {game.away_score ?? 0}
            </div>
          </div>
          <div className="text-center flex flex-col items-center gap-2">
            <TeamBadge team={game.away_team} size="lg" />
            <span className="font-bold text-sm text-slate-900 dark:text-white">{game.away_team?.name}</span>
          </div>
        </div>
      </div>

      {/* Stats tables */}
      <div className="grid md:grid-cols-2 gap-6">
        <LiveStatsTable title={game.home_team?.name} players={homePlayers} teamColor={game.home_team?.primary_color} />
        <LiveStatsTable title={game.away_team?.name} players={awayPlayers} teamColor={game.away_team?.primary_color} />
      </div>
    </div>
  )
}

function aggregateStats(stats: any[]) {
  const byPlayer: Record<string, any> = {}
  stats.forEach(s => {
    const pid = s.player_id
    if (!byPlayer[pid]) {
      byPlayer[pid] = { ...s, player: s.player }
      // zero-out quarter field
      delete byPlayer[pid].quarter
    } else {
      const keys = ['pass_yards','pass_attempts','pass_completions','pass_tds','interceptions_thrown',
        'qb_rush_yards','qb_rush_tds','rush_carries','rush_yards','rush_tds','rb_rec_yards',
        'rb_receptions','rb_targets','rb_fumbles','rec_yards','receptions','rec_targets','rec_tds',
        'rec_fumbles','def_interceptions','fg_made','fg_attempts','ep_made','ep_attempts']
      keys.forEach(k => { byPlayer[pid][k] = (byPlayer[pid][k] ?? 0) + (s[k] ?? 0) })
      byPlayer[pid].sacks = ((byPlayer[pid].sacks ?? 0) + (s.sacks ?? 0))
    }
  })
  return Object.values(byPlayer)
}

/* ── Position-based stat categories (columns shown depend on position) ── */
type StatCol = { h: string; get: (s: any) => string | number; accent?: 'green' | 'red' }
type StatCategory = { key: string; label: string; match: (pos: string) => boolean; cols: StatCol[] }

const STAT_CATEGORIES: StatCategory[] = [
  {
    key: 'passing', label: 'Passing', match: (p) => p === 'QB',
    cols: [
      { h: 'C/ATT', get: (s) => `${s.pass_completions ?? 0}/${s.pass_attempts ?? 0}` },
      { h: 'YDS',   get: (s) => s.pass_yards ?? 0 },
      { h: 'TD',    get: (s) => s.pass_tds ?? 0, accent: 'green' },
      { h: 'INT',   get: (s) => s.interceptions_thrown ?? 0, accent: 'red' },
      { h: 'RUSH',  get: (s) => s.qb_rush_yards ?? 0 },
    ],
  },
  {
    key: 'rushing', label: 'Rushing', match: (p) => p === 'RB',
    cols: [
      { h: 'CAR',     get: (s) => s.rush_carries ?? 0 },
      { h: 'YDS',     get: (s) => s.rush_yards ?? 0 },
      { h: 'TD',      get: (s) => s.rush_tds ?? 0, accent: 'green' },
      { h: 'REC',     get: (s) => s.rb_receptions ?? 0 },
      { h: 'REC YDS', get: (s) => s.rb_rec_yards ?? 0 },
    ],
  },
  {
    key: 'receiving', label: 'Receiving', match: (p) => ['WR', 'TE'].includes(p),
    cols: [
      { h: 'REC', get: (s) => s.receptions ?? 0 },
      { h: 'YDS', get: (s) => s.rec_yards ?? 0 },
      { h: 'TD',  get: (s) => s.rec_tds ?? 0, accent: 'green' },
      { h: 'TGT', get: (s) => s.rec_targets ?? 0 },
    ],
  },
  {
    key: 'defense', label: 'Defense', match: (p) => ['DL', 'LB', 'DB'].includes(p),
    cols: [
      { h: 'SACK', get: (s) => s.sacks ?? 0, accent: 'green' },
      { h: 'INT',  get: (s) => s.def_interceptions ?? 0, accent: 'red' },
    ],
  },
  {
    key: 'kicking', label: 'Kicking', match: (p) => ['K', 'P'].includes(p),
    cols: [
      { h: 'FG', get: (s) => `${s.fg_made ?? 0}/${s.fg_attempts ?? 0}` },
      { h: 'XP', get: (s) => `${s.ep_made ?? 0}/${s.ep_attempts ?? 0}` },
    ],
  },
]

function categoryKeyFor(pos: string): string {
  const cat = STAT_CATEGORIES.find((c) => c.match(pos))
  return cat ? cat.key : 'defense' // unknown/empty position falls back to defense
}

function LiveStatsTable({ title, players, teamColor }: { title: string; players: any[]; teamColor?: string }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: teamColor ?? '#7a7a7a' }}>
        {title}
      </h2>
      {players.length === 0 ? (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl px-4 py-4 text-xs text-slate-500 dark:text-[#7a7a7a] shadow-sm">
          No stats yet.
        </div>
      ) : (
        <div className="space-y-3">
          {STAT_CATEGORIES.map((cat) => {
            const group = players.filter((s: any) => categoryKeyFor(s.player?.positions?.[0] ?? '') === cat.key)
            if (group.length === 0) return null
            return (
              <div key={cat.key} className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl overflow-hidden shadow-sm">
                <div className="px-3 py-1.5 border-b border-black/[0.07] dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#7a7a7a]">
                  {cat.label}
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-black/[0.07] dark:border-white/5">
                      <th className="text-left px-3 py-1.5 text-slate-400 dark:text-[#7a7a7a] font-semibold">Player</th>
                      {cat.cols.map((c) => (
                        <th key={c.h} className="text-center px-2 py-1.5 text-slate-400 dark:text-[#7a7a7a] font-semibold">{c.h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((s: any) => (
                      <tr key={s.player_id} className="border-b border-black/[0.05] dark:border-white/5 last:border-0">
                        <td className="px-3 py-2 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                          {s.player?.first_name?.[0]}. {s.player?.last_name}
                          {s.player?.jersey_number && <span className="text-slate-400 dark:text-[#7a7a7a] ml-1">#{s.player.jersey_number}</span>}
                        </td>
                        {cat.cols.map((c) => {
                          const v = c.get(s)
                          const zeroAccent = c.accent != null && v === 0
                          const color = zeroAccent
                            ? 'text-slate-300 dark:text-[#555]'
                            : c.accent === 'green' ? 'text-[#04a550]'
                            : c.accent === 'red' ? 'text-[#ff1d25]'
                            : 'text-slate-900 dark:text-white'
                          return (
                            <td key={c.h} className={`text-center px-2 py-2 font-semibold tabular-nums ${color}`}>
                              {v}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
