import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'
import type { Team, StandingsWithTeam } from '@/lib/supabase/types'

export const revalidate = 30

export default async function HomePage() {
  const supabase = await createClient()

  const [{ data: teams }, { data: standings }, { data: liveGame }] = await Promise.all([
    supabase.from('teams').select('*').order('name'),
    supabase.from('standings').select('*, team:teams(*)').eq('season', 2026).order('wins', { ascending: false }),
    supabase.from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
      .eq('status', 'live').limit(1).maybeSingle(),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-[#ff1d25]/10 border border-[#ff1d25]/30 rounded-full px-4 py-1 text-[#ff1d25] text-xs font-semibold uppercase tracking-wider mb-2">
          Season 2026
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
          ACSL <span className="text-[#ff1d25]">Stats</span>
        </h1>
        <p className="text-[#7a7a7a] text-sm">Austrian College Sports League — Live Stats & Standings</p>
      </div>

      {liveGame && (
        <Link href="/live" className="block bg-[#ff1d25] rounded-xl p-4 flex items-center justify-between hover:bg-[#e0181f] transition-colors">
          <div className="flex items-center gap-3">
            <span className="animate-pulse w-2 h-2 rounded-full bg-white inline-block" />
            <span className="font-bold text-white text-sm">LIVE NOW</span>
          </div>
          <div className="flex items-center gap-4 text-white font-bold">
            <span>{(liveGame as any).home_team?.short_name ?? '—'}</span>
            <span className="text-2xl">{liveGame.home_score ?? 0} – {liveGame.away_score ?? 0}</span>
            <span>{(liveGame as any).away_team?.short_name ?? '—'}</span>
          </div>
          <span className="text-white/70 text-xs">View Live Stats →</span>
        </Link>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-4">Teams</h2>
          <div className="grid grid-cols-2 gap-3">
            {(teams ?? []).map((team: Team) => (
              <Link key={team.id} href={`/teams/${team.slug}`}
                className="bg-[#111] border border-white/5 rounded-xl p-4 flex items-center gap-3 hover:border-white/20 transition-all group">
                <TeamBadge team={team} size="md" />
                <div>
                  <div className="font-semibold text-sm text-white">{team.name}</div>
                  <div className="text-xs text-[#7a7a7a]">{team.university}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a]">Standings 2026</h2>
            <Link href="/schedule" className="text-xs text-[#7a7a7a] hover:text-white">Full Schedule →</Link>
          </div>
          <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-2 text-[#7a7a7a] font-medium text-xs">#</th>
                  <th className="text-left px-4 py-2 text-[#7a7a7a] font-medium text-xs">Team</th>
                  <th className="text-center px-3 py-2 text-[#7a7a7a] font-medium text-xs">W</th>
                  <th className="text-center px-3 py-2 text-[#7a7a7a] font-medium text-xs">L</th>
                  <th className="text-center px-3 py-2 text-[#7a7a7a] font-medium text-xs">PF</th>
                  <th className="text-center px-3 py-2 text-[#7a7a7a] font-medium text-xs">PA</th>
                </tr>
              </thead>
              <tbody>
                {standings && standings.length > 0 ? (standings as StandingsWithTeam[]).map((s, i) => (
                  <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5 text-[#7a7a7a] text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: s.team.primary_color }} />
                        <span className="font-medium text-sm">{s.team.short_name}</span>
                      </div>
                    </td>
                    <td className="text-center px-3 py-2.5 font-semibold">{s.wins}</td>
                    <td className="text-center px-3 py-2.5 text-[#7a7a7a]">{s.losses}</td>
                    <td className="text-center px-3 py-2.5 text-[#7a7a7a]">{s.points_for}</td>
                    <td className="text-center px-3 py-2.5 text-[#7a7a7a]">{s.points_against}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-[#7a7a7a] text-xs">Season not started yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
