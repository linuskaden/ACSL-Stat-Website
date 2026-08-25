import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Team } from '@/lib/supabase/types'

export const revalidate = 60

export default async function TeamsPage() {
  const supabase = await createClient()
  const { data: teams } = await supabase.from('teams').select('*').order('name')

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {(teams ?? []).map((team: Team) => (
          <Link
            key={team.id}
            href={`/teams/${team.slug}`}
            title={team.name}
            aria-label={team.name}
            className="flex items-center justify-center aspect-[4/3] bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/10 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            {team.logo_url && (
              <img
                src={team.logo_url}
                alt={team.name}
                className="object-contain"
                style={{ width: 'clamp(96px, 20vw, 190px)', height: 'clamp(96px, 20vw, 190px)' }}
              />
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
