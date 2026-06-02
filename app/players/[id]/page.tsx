import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import PlayerPageClient from '@/components/PlayerPageClient'

export const revalidate = 30

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: player } = await supabase
    .from('players')
    .select('*, team:teams(*)')
    .eq('id', id)
    .single()

  if (!player) notFound()

  const { data: career } = await supabase
    .from('career_stats')
    .select('*')
    .eq('player_id', id)
    .order('season', { ascending: false })

  const team = (player as any).team

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/players" className="text-xs text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white mb-4 inline-flex items-center gap-1">
        ← All Players
      </Link>

      <PlayerPageClient
        player={player as any}
        team={team}
        career={career ?? []}
      />
    </div>
  )
}
