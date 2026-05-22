import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const GAME_TYPES = ['regular_season', 'wildcard', 'semifinal', 'final']
const STATUS_OPTIONS = ['scheduled', 'live', 'final']

export default async function AdminGamesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const [{ data: games }, { data: teams }] = await Promise.all([
    supabase.from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
      .eq('season', 2026)
      .order('scheduled_at', { nullsFirst: false }),
    supabase.from('teams').select('*').order('name'),
  ])

  async function createGame(formData: FormData) {
    'use server'
    const supabase = await createClient()
    await (supabase.from('games') as any).insert({
      season: 2026,
      week: formData.get('week') ? Number(formData.get('week')) : null,
      game_type: formData.get('game_type') as string,
      home_team_id: formData.get('home_team_id') as string || null,
      away_team_id: formData.get('away_team_id') as string || null,
      scheduled_at: formData.get('scheduled_at') as string || null,
      location: formData.get('location') as string || null,
      status: 'scheduled',
    })
    redirect('/admin/games')
  }

  async function updateGameStatus(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const gameId = formData.get('game_id') as string
    const status = formData.get('status') as string
    const homeScore = formData.get('home_score') ? Number(formData.get('home_score')) : null
    const awayScore = formData.get('away_score') ? Number(formData.get('away_score')) : null
    await supabase.from('games').update({ status, home_score: homeScore, away_score: awayScore }).eq('id', gameId)
    redirect('/admin/games')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">Game Management</h1>
      </div>

      {/* Create Game Form */}
      <div className="bg-[#111] border border-white/5 rounded-xl p-5 mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-4">Create New Game</h2>
        <form action={createGame}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-[#7a7a7a] block mb-1">Type</label>
              <select name="game_type" className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#ff1d25]">
                {GAME_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#7a7a7a] block mb-1">Week</label>
              <input name="week" type="number" min="1" max="10" placeholder="1"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#ff1d25]" />
            </div>
            <div>
              <label className="text-xs text-[#7a7a7a] block mb-1">Home Team</label>
              <select name="home_team_id" className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#ff1d25]">
                <option value="">TBD</option>
                {(teams ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.short_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#7a7a7a] block mb-1">Away Team</label>
              <select name="away_team_id" className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#ff1d25]">
                <option value="">TBD</option>
                {(teams ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.short_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#7a7a7a] block mb-1">Date & Time</label>
              <input name="scheduled_at" type="datetime-local"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#ff1d25]" />
            </div>
            <div>
              <label className="text-xs text-[#7a7a7a] block mb-1">Location</label>
              <input name="location" type="text" placeholder="Venue"
                className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-[#ff1d25]" />
            </div>
          </div>
          <button type="submit" className="mt-3 bg-[#ff1d25] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#e0181f] transition-colors">
            Create Game
          </button>
        </form>
      </div>

      {/* Games list */}
      <div className="space-y-2">
        {(games ?? []).map((game: any) => (
          <div key={game.id} className={`bg-[#111] border rounded-xl p-4 ${game.status === 'live' ? 'border-[#ff1d25]/40' : 'border-white/5'}`}>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <div className="text-center min-w-[80px]">
                  <div className="font-bold text-sm">
                    {game.home_team?.short_name ?? 'TBD'}
                    <span className="text-[#7a7a7a] mx-1">vs</span>
                    {game.away_team?.short_name ?? 'TBD'}
                  </div>
                  <div className="text-xs text-[#7a7a7a]">{game.game_type?.replace('_', ' ')}</div>
                </div>

                {(game.status === 'final' || game.status === 'live') && (
                  <div className="font-black text-lg">
                    {game.home_score ?? 0} – {game.away_score ?? 0}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  game.status === 'live' ? 'bg-[#ff1d25]/20 text-[#ff1d25]' :
                  game.status === 'final' ? 'bg-[#04a550]/20 text-[#04a550]' :
                  'bg-white/5 text-[#7a7a7a]'
                }`}>
                  {game.status === 'live' && <span className="animate-pulse mr-1">●</span>}
                  {game.status}
                </span>

                {/* Quick update form */}
                <form action={updateGameStatus} className="flex items-center gap-2">
                  <input type="hidden" name="game_id" value={game.id} />
                  <input name="home_score" type="number" defaultValue={game.home_score ?? ''} placeholder="H"
                    className="w-12 bg-[#0a0a0a] border border-white/10 rounded px-1.5 py-1 text-white text-xs text-center focus:outline-none focus:border-[#ff1d25]" />
                  <input name="away_score" type="number" defaultValue={game.away_score ?? ''} placeholder="A"
                    className="w-12 bg-[#0a0a0a] border border-white/10 rounded px-1.5 py-1 text-white text-xs text-center focus:outline-none focus:border-[#ff1d25]" />
                  <select name="status" defaultValue={game.status}
                    className="bg-[#0a0a0a] border border-white/10 rounded px-1.5 py-1 text-white text-xs focus:outline-none focus:border-[#ff1d25]">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="submit" className="text-xs text-[#7a7a7a] hover:text-white border border-white/10 px-2 py-1 rounded transition-colors">
                    Save
                  </button>
                </form>

                {game.status === 'live' || game.status === 'scheduled' ? (
                  <Link href={`/admin/games/${game.id}/track`}
                    className="bg-[#ff1d25] text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-[#e0181f] transition-colors">
                    Track Stats
                  </Link>
                ) : (
                  <Link href={`/admin/games/${game.id}/track`}
                    className="text-xs text-[#7a7a7a] hover:text-white border border-white/10 px-3 py-1.5 rounded transition-colors">
                    View Stats
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
