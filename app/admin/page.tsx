import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const [{ count: playerCount }, { count: gameCount }, { data: liveGames }] = await Promise.all([
    supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('games').select('*', { count: 'exact', head: true }).eq('season', 2026),
    supabase.from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
      .eq('status', 'live'),
  ])

  async function handleLogout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/admin/login')
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Admin Dashboard</h1>
          <p className="text-slate-500 dark:text-[#7a7a7a] text-sm mt-1">ACSL Stats Operator Panel</p>
        </div>
        <form action={handleLogout}>
          <button type="submit" className="text-xs text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white border border-black/10 dark:border-white/10 rounded px-3 py-1.5 transition-colors">
            Sign Out
          </button>
        </form>
      </div>

      {/* Live game alert */}
      {liveGames && liveGames.length > 0 && (
        <div className="bg-[#ff1d25]/10 border border-[#ff1d25]/30 rounded-xl p-4 mb-6">
          {liveGames.map((g: any) => (
            <div key={g.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="animate-pulse w-2 h-2 rounded-full bg-[#ff1d25] inline-block" />
                <span className="font-bold text-[#ff1d25] text-sm">LIVE: {g.home_team?.short_name} vs {g.away_team?.short_name}</span>
              </div>
              <Link href={`/admin/games/${g.id}/track`}
                className="bg-[#ff1d25] text-white text-xs font-bold px-4 py-1.5 rounded hover:bg-[#e0181f] transition-colors">
                Open Tracker →
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Players', value: playerCount ?? 0, href: '/admin/players' },
          { label: 'Games 2026', value: gameCount ?? 0, href: '/admin/games' },
          { label: 'Live Games', value: liveGames?.length ?? 0 },
          { label: 'Season', value: '2026' },
        ].map(s => (
          <Link key={s.label} href={s.href ?? '#'}
            className={`bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-4 shadow-sm ${s.href ? 'hover:border-black/15 dark:hover:border-white/20 transition-colors' : ''}`}>
            <div className="text-3xl font-black text-slate-900 dark:text-white">{s.value}</div>
            <div className="text-xs text-slate-500 dark:text-[#7a7a7a] mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-3 gap-4">
        <AdminCard
          title="Player Management"
          desc="Add, edit, or remove players from the roster."
          href="/admin/players"
          icon="👤"
        />
        <AdminCard
          title="Game Management"
          desc="Create games, set scores, and manage the schedule."
          href="/admin/games"
          icon="🏈"
        />
        <AdminCard
          title="vMix Overlay Control"
          desc="Select players, toggle live/career stats, show or hide the lower-third graphic."
          href="/admin/overlay"
          icon="📺"
        />
      </div>
    </div>
  )
}

function AdminCard({ title, desc, href, icon, external }: {
  title: string; desc: string; href: string; icon: string; external?: boolean
}) {
  return (
    <Link href={href} target={external ? '_blank' : undefined}
      className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-black/15 dark:hover:border-white/20 transition-all group">
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-[#ff1d25] transition-colors">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-[#7a7a7a] mt-1">{desc}</p>
    </Link>
  )
}
