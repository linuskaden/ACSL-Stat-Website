import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TeamPageNav from '@/components/TeamPageNav'
import TeamRoster from '@/components/TeamRoster'
import TeamBand from '@/components/TeamBand'

export const revalidate = 60

export default async function TeamRosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: team } = await supabase.from('teams').select('*').eq('slug', slug).single()
  if (!team) notFound()

  const { data: players } = await supabase
    .from('players')
    .select('id, first_name, last_name, nickname, jersey_number, positions, field_of_study, height_cm, weight_kg')
    .eq('team_id', team.id)
    .eq('is_active', true)
    .order('jersey_number', { nullsFirst: false })

  const primary = team.primary_color || '#111'

  return (
    <div>
      <TeamBand team={team} subtitle={`${(players ?? []).length} Spieler`} />
      <TeamPageNav slug={slug} primary={primary} />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <TeamRoster players={(players ?? []) as any[]} primary={primary} />
      </div>
    </div>
  )
}
