import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'
import type { PlayerWithTeam } from '@/lib/supabase/types'

export const revalidate = 60

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: team } = await supabase.from('teams').select('*').eq('slug', slug).single()
  if (!team) notFound()

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', team.id)
    .eq('is_active', true)
    .order('jersey_number', { nullsFirst: false })

  const grouped: Record<string, typeof players> = {}
  const posOrder = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P', 'Other']
  ;(players ?? []).forEach(p => {
    const pos = p.positions[0] ?? 'Other'
    if (!grouped[pos]) grouped[pos] = []
    grouped[pos]!.push(p)
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div
        className="rounded-2xl p-8 mb-8 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${team.primary_color}22, #111)`, border: `1px solid ${team.primary_color}33` }}
      >
        <div className="relative flex items-start gap-6">
          <TeamBadge team={team} size="lg" />
          <div>
            <h1 className="text-3xl font-black text-white">{team.name}</h1>
            <p className="text-[#7a7a7a] mt-1">{team.university} · Season 2026</p>
            <p className="text-sm text-[#7a7a7a] mt-1">{players?.length ?? 0} Active Players</p>
            <div className="flex gap-2 mt-3">
              <div className="w-5 h-5 rounded-full" style={{ background: team.primary_color }} />
              <div className="w-5 h-5 rounded-full" style={{ background: team.secondary_color }} />
              {team.tertiary_color && <div className="w-5 h-5 rounded-full" style={{ background: team.tertiary_color }} />}
            </div>
          </div>
        </div>
      </div>

      {/* Roster by position */}
      <div className="space-y-6">
        {posOrder.map(pos => {
          const group = grouped[pos]
          if (!group?.length) return null
          return (
            <div key={pos}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-3">{pos}</h2>
              <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-2 text-[#7a7a7a] font-medium text-xs w-12">#</th>
                      <th className="text-left px-4 py-2 text-[#7a7a7a] font-medium text-xs">Name</th>
                      <th className="text-left px-4 py-2 text-[#7a7a7a] font-medium text-xs hidden md:table-cell">Study</th>
                      <th className="text-left px-4 py-2 text-[#7a7a7a] font-medium text-xs hidden lg:table-cell">From</th>
                      <th className="text-center px-3 py-2 text-[#7a7a7a] font-medium text-xs hidden md:table-cell">Ht</th>
                      <th className="text-center px-3 py-2 text-[#7a7a7a] font-medium text-xs hidden md:table-cell">Wt</th>
                      <th className="text-left px-4 py-2 text-[#7a7a7a] font-medium text-xs hidden xl:table-cell">Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map(p => (
                      <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5">
                          <span className="font-bold text-xs" style={{ color: team.primary_color }}>
                            {p.jersey_number ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Link href={`/players/${p.id}`} className="hover:text-[#ff1d25] transition-colors">
                            <span className="font-semibold">{p.first_name} {p.last_name}</span>
                            {p.nickname && <span className="text-[#7a7a7a] text-xs ml-1">"{p.nickname}"</span>}
                          </Link>
                          <div className="text-xs text-[#7a7a7a]">{p.positions.join(' / ')}</div>
                        </td>
                        <td className="px-4 py-2.5 text-[#7a7a7a] text-xs hidden md:table-cell max-w-[160px] truncate">
                          {p.field_of_study ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-[#7a7a7a] text-xs hidden lg:table-cell">
                          {p.hometown ? `${p.hometown}${p.country ? `, ${p.country}` : ''}` : '—'}
                        </td>
                        <td className="text-center px-3 py-2.5 text-[#7a7a7a] text-xs hidden md:table-cell">
                          {p.height_cm ? `${p.height_cm}` : '—'}
                        </td>
                        <td className="text-center px-3 py-2.5 text-[#7a7a7a] text-xs hidden md:table-cell">
                          {p.weight_kg ? `${p.weight_kg}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-[#7a7a7a] text-xs hidden xl:table-cell">
                          {p.acsl_since ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
