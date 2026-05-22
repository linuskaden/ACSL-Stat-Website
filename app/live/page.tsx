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
    <div className="max-w-4xl mx-auto px-4 py-16 text-center text-[#7a7a7a]">Loading...</div>
  )

  if (!game) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-4">📺</div>
      <h1 className="text-2xl font-black mb-2">No Live Game</h1>
      <p className="text-[#7a7a7a]">Check back when a game is in progress.</p>
      <Link href="/schedule" className="mt-4 inline-block text-[#ff1d25] text-sm hover:underline">View Schedule →</Link>
    </div>
  )

  const totals = aggregateStats(stats)
  const homePlayers = totals.filter((s: any) => s.player?.team_id === game.home_team?.id)
  const awayPlayers = totals.filter((s: any) => s.player?.team_id === game.away_team?.id)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Scoreboard */}
      <div className="bg-[#111] border border-[#ff1d25]/30 rounded-2xl p-6">
        <div className="flex items-center justify-center gap-1 mb-4">
          <span className="animate-pulse w-2 h-2 rounded-full bg-[#ff1d25] inline-block" />
          <span className="text-[#ff1d25] text-xs font-bold uppercase tracking-widest">Live</span>
        </div>
        <div className="flex items-center justify-center gap-8">
          <div className="text-center flex flex-col items-center gap-2">
            <TeamBadge team={game.home_team} size="lg" />
            <span className="font-bold text-sm">{game.home_team?.name}</span>
          </div>
          <div className="text-center">
            <div className="text-5xl font-black tabular-nums">
              {game.home_score ?? 0} <span className="text-[#7a7a7a]">–</span> {game.away_score ?? 0}
            </div>
          </div>
          <div className="text-center flex flex-col items-center gap-2">
            <TeamBadge team={game.away_team} size="lg" />
            <span className="font-bold text-sm">{game.away_team?.name}</span>
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

function LiveStatsTable({ title, players, teamColor }: { title: string; players: any[]; teamColor?: string }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: teamColor ?? '#7a7a7a' }}>
        {title}
      </h2>
      <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
        {players.length === 0 ? (
          <p className="px-4 py-4 text-xs text-[#7a7a7a]">No stats yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-3 py-2 text-[#7a7a7a]">Player</th>
                <th className="text-left px-2 py-2 text-[#7a7a7a]">Pos</th>
                <th className="text-center px-2 py-2 text-[#7a7a7a]">YDS</th>
                <th className="text-center px-2 py-2 text-[#7a7a7a]">TD</th>
                <th className="text-center px-2 py-2 text-[#7a7a7a]">INT</th>
              </tr>
            </thead>
            <tbody>
              {players.map((s: any) => {
                const pos = s.player?.positions?.[0] ?? ''
                const isQB = pos === 'QB'
                const isRB = pos === 'RB'
                const isRec = ['WR','TE'].includes(pos)
                const isDef = ['DL','LB','DB'].includes(pos)
                const isK = ['K','P'].includes(pos)
                const yds = isQB ? s.pass_yards + s.qb_rush_yards
                  : isRB ? s.rush_yards + s.rb_rec_yards
                  : isRec ? s.rec_yards
                  : 0
                const tds = isQB ? s.pass_tds + s.qb_rush_tds
                  : isRB ? s.rush_tds
                  : isRec ? s.rec_tds
                  : isK ? (s.fg_made * 3 + s.ep_made)
                  : 0
                const intVal = isQB ? s.interceptions_thrown : isDef ? s.def_interceptions : 0
                return (
                  <tr key={s.player_id} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2 font-medium">
                      {s.player?.first_name?.[0]}. {s.player?.last_name}
                      {s.player?.jersey_number && <span className="text-[#7a7a7a] ml-1">#{s.player.jersey_number}</span>}
                    </td>
                    <td className="px-2 py-2 text-[#7a7a7a]">{pos}</td>
                    <td className="text-center px-2 py-2 font-semibold">{isK ? `${s.fg_made}/${s.fg_attempts} FG` : yds}</td>
                    <td className="text-center px-2 py-2 font-semibold text-[#04a550]">{isDef ? s.sacks : tds}</td>
                    <td className="text-center px-2 py-2 text-[#ff1d25]">{intVal > 0 ? intVal : '—'}</td>
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
