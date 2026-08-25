import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Team } from '@/lib/supabase/types'

export const revalidate = 60

export default async function TeamsPage() {
  const supabase = await createClient()
  const { data: teams } = await supabase.from('teams').select('*').order('name')

  return (
    // One screen, no scrolling.
    <div className="flex items-center overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
      <div className="w-full max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 place-items-center">
          {(teams ?? []).map((team: Team) => (
            <Link
              key={team.id}
              href={`/teams/${team.slug}`}
              title={team.name}
              aria-label={team.name}
              className="flex flex-col items-center gap-3 rounded-2xl px-6 py-5 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors duration-200"
            >
              {team.logo_url && (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="object-contain"
                  style={{ width: 'clamp(120px, 17vw, 210px)', height: 'clamp(120px, 17vw, 210px)' }}
                />
              )}
              <span
                className="font-black text-slate-900 dark:text-white"
                style={{ fontSize: 'clamp(16px, 2vw, 24px)' }}
              >
                {team.short_name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
