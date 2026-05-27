import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TeamRosterGrid from '@/components/TeamRosterGrid'

export const revalidate = 60

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const [{ data: team }, { data: allTeams }] = await Promise.all([
    supabase.from('teams').select('*').eq('slug', slug).single(),
    supabase.from('teams').select('*').order('name'),
  ])

  if (!team) notFound()

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('team_id', team.id)
    .eq('is_active', true)
    .order('jersey_number', { nullsFirst: false })

  return (
    <TeamRosterGrid
      team={team as any}
      players={(players ?? []) as any[]}
      allTeams={(allTeams ?? []) as any[]}
    />
  )
}
