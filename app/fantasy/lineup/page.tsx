import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSelectedCompetition } from '@/lib/competition'
import { getSelectedSeason } from '@/lib/season'
import LineupBuilder from '@/components/fantasy/LineupBuilder'

export default async function LineupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/fantasy/login')

  const { data: manager } = await supabase.from('fantasy_managers').select('id').eq('id', user.id).maybeSingle()
  if (!manager) redirect('/fantasy')

  const competition = await getSelectedCompetition()
  const season = await getSelectedSeason(competition)

  const { data: rounds } = await supabase.from('fantasy_rounds')
    .select('id,name,status,lock_at,sort_order')
    .eq('competition_id', competition.id).eq('season', season)
    .order('sort_order')
  const openRound = (rounds ?? []).find(r => r.status === 'open')

  if (!openRound) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-black text-slate-900 mb-2">Gerade keine offene Round</h1>
        <p className="text-slate-500 text-sm mb-4">Sobald die nächste Round öffnet, kannst du hier dein Lineup stellen.</p>
        <Link href="/fantasy" className="text-[#16163f] font-bold">← Zurück zum Fantasy-Hub</Link>
      </div>
    )
  }

  const { data: rg } = await supabase.from('fantasy_round_games').select('game_id').eq('round_id', openRound.id)
  const gameIds = (rg ?? []).map(r => r.game_id)

  const [{ data: players }, { data: offPtsRows }, { data: dstPtsRows }, { data: entry }] = await Promise.all([
    supabase.from('players').select('id,first_name,last_name,positions,jersey_number,team_id,status').eq('competition_id', competition.id),
    gameIds.length ? supabase.from('fantasy_offense_points').select('player_id,points').in('game_id', gameIds) : Promise.resolve({ data: [] }),
    gameIds.length ? supabase.from('fantasy_dst_points').select('team_id,points').in('game_id', gameIds) : Promise.resolve({ data: [] }),
    supabase.from('fantasy_entries').select('*').eq('round_id', openRound.id).eq('manager_id', user.id).maybeSingle(),
  ])

  const active = (players ?? []).filter((p: { status?: string }) => p.status === 'active')
  const teamIds = [...new Set(active.map((p: { team_id: string }) => p.team_id).filter(Boolean))]
  const { data: teams } = teamIds.length
    ? await supabase.from('teams').select('id,name,short_name,primary_color').in('id', teamIds)
    : { data: [] }

  const offPts: Record<string, number> = {}
  for (const r of (offPtsRows ?? []) as { player_id: string; points: number }[]) offPts[r.player_id] = Number(r.points)
  const dstPts: Record<string, number> = {}
  for (const r of (dstPtsRows ?? []) as { team_id: string; points: number }[]) dstPts[r.team_id] = Number(r.points)

  return (
    <LineupBuilder
      roundId={openRound.id}
      roundName={openRound.name}
      lockAt={openRound.lock_at}
      managerId={user.id}
      players={active as never}
      teams={(teams ?? []) as never}
      offPts={offPts}
      dstPts={dstPts}
      entry={(entry ?? null) as never}
    />
  )
}
