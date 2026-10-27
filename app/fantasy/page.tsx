import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getSelectedCompetition } from '@/lib/competition'
import { getSelectedSeason } from '@/lib/season'
import UsernameForm from '@/components/fantasy/UsernameForm'
import SignOutButton from '@/components/fantasy/SignOutButton'

type Round = { id: string; name: string; status: string; lock_at: string | null; sort_order: number }
type BoardRow = { username: string; points: number; rnk?: number; rounds_played?: number }

export default async function FantasyHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const competition = await getSelectedCompetition()
  const season = await getSelectedSeason(competition)

  // Not logged in → landing + login CTA
  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="font-black italic tracking-tight text-4xl text-slate-900 mb-3">
          ACSL<span className="text-[#16163f]">.</span>Fantasy
        </div>
        <p className="text-slate-600 mb-8">
          Stell für jede Round dein Lineup aus echten ACSL-Spielern — 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX, 1 Defense.
          Ein Captain zählt doppelt. Jede Woche wird gerankt, dazu ein Season-Leaderboard.
        </p>
        <Link href="/fantasy/login" className="inline-block bg-[#16163f] hover:bg-[#101033] text-white font-bold px-8 py-3 rounded-xl transition-colors">
          Einloggen / Mitmachen
        </Link>
      </div>
    )
  }

  // Logged in but no profile → choose username
  const { data: manager } = await supabase.from('fantasy_managers').select('id,username').eq('id', user.id).maybeSingle()
  if (!manager) {
    return <div className="px-4 py-16"><UsernameForm userId={user.id} /></div>
  }

  const { data: roundsData } = await supabase.from('fantasy_rounds')
    .select('id,name,status,lock_at,sort_order')
    .eq('competition_id', competition.id).eq('season', season)
    .order('sort_order')
  const rounds = (roundsData ?? []) as Round[]
  const openRound = rounds.find(r => r.status === 'open')
  const boardRound = openRound ?? [...rounds].reverse().find(r => r.status === 'final' || r.status === 'locked')

  let myScore: number | null = null
  if (openRound) {
    const { data } = await supabase.from('fantasy_entry_scores')
      .select('points').eq('round_id', openRound.id).eq('manager_id', user.id).maybeSingle()
    myScore = data?.points != null ? Number(data.points) : null
  }

  let board: BoardRow[] = []
  if (boardRound) {
    const { data } = await supabase.from('fantasy_round_leaderboard')
      .select('username,points,rnk').eq('round_id', boardRound.id).order('rnk').limit(20)
    board = (data ?? []) as BoardRow[]
  }

  const { data: seasonData } = await supabase.from('fantasy_season_leaderboard')
    .select('username,points,rounds_played')
    .eq('season', season).eq('competition_id', competition.id)
    .order('points', { ascending: false }).limit(20)
  const seasonBoard = (seasonData ?? []) as BoardRow[]

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="font-black italic tracking-tight text-2xl text-slate-900">
            ACSL<span className="text-[#16163f]">.</span>Fantasy
          </div>
          <p className="text-xs text-slate-500">Eingeloggt als <b>{manager.username}</b></p>
        </div>
        <SignOutButton />
      </div>

      {/* Open round */}
      {openRound ? (
        <div className="rounded-2xl border border-[#16163f]/20 bg-[#16163f] text-white p-5 mb-4">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1">Offene Round</div>
          <div className="text-xl font-black mb-3">{openRound.name}</div>
          <div className="flex items-center justify-between">
            <Link href="/fantasy/lineup" className="inline-block bg-white text-[#16163f] font-bold px-5 py-2.5 rounded-xl">
              {myScore != null ? 'Lineup ändern' : 'Lineup stellen'}
            </Link>
            {myScore != null && (
              <div className="text-right">
                <div className="text-[11px] text-white/60 uppercase tracking-wide">Dein Score</div>
                <div className="text-2xl font-black tabular-nums">{myScore}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white p-5 mb-4 text-center">
          <p className="text-slate-500 text-sm">Gerade keine offene Round. Die nächste kommt zum nächsten Spieltag.</p>
        </div>
      )}

      {/* Round leaderboard */}
      <Board title={boardRound ? `Leaderboard — ${boardRound.name}` : 'Leaderboard'} rows={board} showRank />

      {/* Season leaderboard */}
      <div className="h-4" />
      <Board title="Season-Leaderboard" rows={seasonBoard} />
    </div>
  )
}

function Board({ title, rows, showRank }: { title: string; rows: BoardRow[]; showRank?: boolean }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-black/10">
        <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-400 text-center">Noch keine Einträge.</p>
      ) : (
        <ul>
          {rows.map((r, i) => (
            <li key={`${r.username}-${i}`} className="flex items-center gap-3 px-4 py-2.5 border-b border-black/5 last:border-0">
              <span className="w-6 text-sm font-black text-slate-400 tabular-nums">{showRank ? (r.rnk ?? i + 1) : i + 1}</span>
              <span className="flex-1 font-bold text-slate-900 truncate">{r.username}</span>
              {r.rounds_played != null && <span className="text-[11px] text-slate-400">{r.rounds_played} Rd</span>}
              <span className="text-sm font-black text-[#16163f] tabular-nums">{Number(r.points).toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
