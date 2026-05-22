import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'
import type { Team } from '@/lib/supabase/types'

export const revalidate = 60

export default async function TeamsPage() {
  const supabase = await createClient()
  const { data: teams } = await supabase.from('teams').select('*').order('name')
  const { data: playerCounts } = await supabase
    .from('players')
    .select('team_id')
    .eq('is_active', true)

  const countByTeam: Record<string, number> = {}
  playerCounts?.forEach(p => {
    if (p.team_id) countByTeam[p.team_id] = (countByTeam[p.team_id] ?? 0) + 1
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-black mb-6">Teams</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(teams ?? []).map((team: Team) => (
          <Link
            key={team.id}
            href={`/teams/${team.slug}`}
            className="bg-[#111] border border-white/5 rounded-2xl p-6 hover:border-white/20 transition-all group overflow-hidden relative"
          >
            <div
              className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity"
              style={{ background: `linear-gradient(135deg, ${team.primary_color}, transparent)` }}
            />
            <div className="relative">
              <TeamBadge team={team} size="lg" />
              <div className="mt-4">
                <h2 className="text-xl font-black text-white">{team.name}</h2>
                <p className="text-[#7a7a7a] text-sm mt-1">{team.university}</p>
                <p className="text-[#7a7a7a] text-xs mt-2">{countByTeam[team.id] ?? 0} players</p>
              </div>
              <div className="mt-4 flex gap-2">
                <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: team.primary_color, background: team.primary_color }} />
                <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: team.secondary_color, background: team.secondary_color }} />
                {team.tertiary_color && (
                  <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: team.tertiary_color, background: team.tertiary_color }} />
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
