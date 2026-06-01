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
    <div>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-black/[0.06] dark:border-white/10 bg-gradient-to-b from-white to-[#f7f8fa] dark:from-[#0a0a0a] dark:to-[#0a0a0a]">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#ff1d25]/10 blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-[#ff1d25]/10 border border-[#ff1d25]/30 rounded-full px-4 py-1 text-[#ff1d25] text-xs font-bold uppercase tracking-wider mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff1d25]" />
              Season 2026
            </div>
            <h1 className="text-5xl md:text-7xl font-black italic tracking-tight leading-[0.95] text-slate-900 dark:text-white">
              ACSL <span className="text-[#ff1d25]">Stats</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 dark:text-[#9a9a9a] max-w-xl">
              Austrian College Sports League — live scores, team standings and player statistics.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/teams" className="px-5 py-2.5 rounded-lg bg-[#ff1d25] text-white font-semibold text-sm hover:bg-[#e0181f] transition-colors">
                Explore Teams
              </Link>
              <Link href="/schedule" className="px-5 py-2.5 rounded-lg border border-black/10 dark:border-white/15 text-slate-700 dark:text-white font-semibold text-sm hover:bg-black/[0.04] dark:hover:bg-white/5 transition-colors">
                Full Schedule
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-10 space-y-10">
        {liveGame && (
          <Link href="/live" className="flex items-center justify-between gap-4 bg-[#ff1d25] rounded-xl p-4 hover:bg-[#e0181f] transition-colors shadow-lg shadow-[#ff1d25]/20">
            <div className="flex items-center gap-3">
              <span className="animate-pulse w-2 h-2 rounded-full bg-white inline-block" />
              <span className="font-bold text-white text-sm">LIVE NOW</span>
            </div>
            <div className="flex items-center gap-4 text-white font-bold">
              <span>{(liveGame as any).home_team?.short_name ?? '—'}</span>
              <span className="text-2xl">{liveGame.home_score ?? 0} – {liveGame.away_score ?? 0}</span>
              <span>{(liveGame as any).away_team?.short_name ?? '—'}</span>
            </div>
            <span className="text-white/70 text-xs hidden sm:block">View Live Stats →</span>
          </Link>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-4">Teams</h2>
            <div className="grid grid-cols-2 gap-3">
              {(teams ?? []).map((team: Team) => (
                <Link key={team.id} href={`/teams/${team.slug}`}
                  className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-black/15 dark:hover:border-white/20 transition-all">
                  <TeamBadge team={team} size="md" />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">{team.name}</div>
                    <div className="text-xs text-slate-500 dark:text-[#7a7a7a] truncate">{team.university}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a]">Standings 2026</h2>
              <Link href="/schedule" className="text-xs text-slate-500 dark:text-[#7a7a7a] hover:text-[#ff1d25]">Full Schedule →</Link>
            </div>
            <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.07] dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                    <th className="text-left px-4 py-2.5 text-slate-400 dark:text-[#7a7a7a] font-semibold text-xs">#</th>
                    <th className="text-left px-4 py-2.5 text-slate-400 dark:text-[#7a7a7a] font-semibold text-xs">Team</th>
                    <th className="text-center px-3 py-2.5 text-slate-400 dark:text-[#7a7a7a] font-semibold text-xs">W</th>
                    <th className="text-center px-3 py-2.5 text-slate-400 dark:text-[#7a7a7a] font-semibold text-xs">L</th>
                    <th className="text-center px-3 py-2.5 text-slate-400 dark:text-[#7a7a7a] font-semibold text-xs">PF</th>
                    <th className="text-center px-3 py-2.5 text-slate-400 dark:text-[#7a7a7a] font-semibold text-xs">PA</th>
                  </tr>
                </thead>
                <tbody>
                  {standings && standings.length > 0 ? (standings as StandingsWithTeam[]).map((s, i) => (
                    <tr key={s.id} className="border-b border-black/[0.05] dark:border-white/5 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-slate-400 dark:text-[#7a7a7a] text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: s.team.primary_color }} />
                          <span className="font-medium text-sm text-slate-900 dark:text-white">{s.team.short_name}</span>
                        </div>
                      </td>
                      <td className="text-center px-3 py-2.5 font-semibold text-slate-900 dark:text-white">{s.wins}</td>
                      <td className="text-center px-3 py-2.5 text-slate-500 dark:text-[#7a7a7a]">{s.losses}</td>
                      <td className="text-center px-3 py-2.5 text-slate-500 dark:text-[#7a7a7a]">{s.points_for}</td>
                      <td className="text-center px-3 py-2.5 text-slate-500 dark:text-[#7a7a7a]">{s.points_against}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-[#7a7a7a] text-xs">Season not started yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
