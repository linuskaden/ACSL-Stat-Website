import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason } from '@/lib/season'
import StandingsTable from '@/components/StandingsTable'
import type { StandingsWithTeam } from '@/lib/supabase/types'

export const revalidate = 30

export default async function StandingsPage() {
  const supabase = await createClient()
  const season = await getSelectedSeason()

  const { data: standings } = await supabase
    .from('standings')
    .select('*, team:teams(*)')
    .eq('season', season)
    .order('wins', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl md:text-4xl font-black italic tracking-tight text-slate-900 dark:text-white mb-1">
        Standings <span className="text-[#ff1d25]">{season}</span>
      </h1>
      <p className="text-slate-500 dark:text-[#7a7a7a] text-sm mb-8">
        Austrian College Sports League — Regular Season
      </p>

      <div className="text-base [&_td]:py-3.5 [&_th]:py-3.5">
        <StandingsTable standings={(standings ?? []) as StandingsWithTeam[]} />
      </div>
    </div>
  )
}
