import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Team } from '@/lib/supabase/types'

export const revalidate = 60

export default async function TeamsPage() {
  const supabase = await createClient()
  const { data: teams } = await supabase.from('teams').select('*').order('name')

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-10 place-items-center">
        {(teams ?? []).map((team: Team) => (
          <Link
            key={team.id}
            href={`/teams/${team.slug}`}
            title={team.name}
            aria-label={team.name}
            className="flex items-center justify-center p-2 hover:scale-105 transition-transform duration-200"
          >
            {team.logo_url && (
              <img
                src={team.logo_url}
                alt={team.name}
                className="object-contain"
                style={{ width: 'clamp(130px, 26vw, 250px)', height: 'clamp(130px, 26vw, 250px)' }}
              />
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
