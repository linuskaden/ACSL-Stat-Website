import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

const GAME_TYPES = ['regular_season', 'wildcard', 'semifinal', 'final']
const STATUS_OPTIONS = ['scheduled', 'live', 'final']

const ROUND_LABEL: Record<string, string> = {
  wildcard: 'Wildcard',
  semifinal: 'Semifinal',
  final: 'Championship',
}

export default async function AdminGamesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const [{ data: games }, { data: teams }, { data: bracket }] = await Promise.all([
    supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
      .eq('season', 2026)
      .order('scheduled_at', { nullsFirst: false }),
    supabase.from('teams').select('*').order('name'),
    supabase.from('playoff_bracket').select('*').eq('season', 2026),
  ])

  // Map: game_id → bracket entry (winner_id tells us if already advanced)
  const bracketByGameId: Record<string, any> = {}
  ;(bracket ?? []).forEach((b: any) => { if (b.game_id) bracketByGameId[b.game_id] = b })

  /* ─── Server actions ─── */

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

  /**
   * Advance winner of a wildcard or semifinal game to the next round.
   *
   * Works entirely from the games table (sorted by scheduled_at):
   *   wildcard  game #0 → semifinal game #0, away slot
   *   wildcard  game #1 → semifinal game #1, away slot
   *   semifinal game #0 → final game #0, home slot
   *   semifinal game #1 → final game #0, away slot
   *
   * Also updates playoff_bracket entries if they exist.
   */
  async function advanceWinner(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const gameId = formData.get('game_id') as string

    // 1. Load current game
    const { data: game } = await supabase
      .from('games').select('*').eq('id', gameId).single()
    if (!game || game.status !== 'final') { redirect('/admin/games'); return }

    const currentRound = game.game_type as string
    if (!['wildcard', 'semifinal'].includes(currentRound)) { redirect('/admin/games'); return }

    // 2. Determine winner (higher score wins; tie → home team)
    const winnerId = (game.home_score ?? 0) >= (game.away_score ?? 0)
      ? game.home_team_id
      : game.away_team_id
    if (!winnerId) { redirect('/admin/games'); return }

    // 3. Find position of this game among all games of same round (sorted by date)
    const { data: sameRound } = await supabase
      .from('games').select('id')
      .eq('season', game.season).eq('game_type', currentRound)
      .order('scheduled_at', { nullsFirst: false })
    const posIdx = (sameRound ?? []).findIndex((g: any) => g.id === gameId)

    // 4. Determine next round + target slot
    const nextRound = currentRound === 'wildcard' ? 'semifinal' : 'final'
    // wildcard games fill the AWAY slot of the corresponding semifinal
    // semifinal #0 → final HOME; semifinal #1 → final AWAY
    const nextSlot: 'home_team_id' | 'away_team_id' =
      currentRound === 'wildcard' ? 'away_team_id'
      : posIdx === 0 ? 'home_team_id' : 'away_team_id'

    // 5. Find next-round game (REVERSED index for wildcard→semi, always index 0 for semi→final)
    //    wildcard #0 → semifinal #1, wildcard #1 → semifinal #0
    const { data: nextRoundGames } = await supabase
      .from('games').select('id')
      .eq('season', game.season).eq('game_type', nextRound)
      .order('scheduled_at', { nullsFirst: false })
    const totalWildcards = (sameRound ?? []).length
    const nextGameIdx = currentRound === 'wildcard' ? (totalWildcards - 1 - posIdx) : 0
    const nextGameId = (nextRoundGames ?? [])[nextGameIdx]?.id

    if (nextGameId) {
      await supabase.from('games').update({ [nextSlot]: winnerId }).eq('id', nextGameId)
    }

    // 6. Also sync playoff_bracket if entries exist
    const { data: bracketEntry } = await supabase
      .from('playoff_bracket').select('*').eq('game_id', gameId).maybeSingle()
    if (bracketEntry) {
      await supabase.from('playoff_bracket').update({ winner_id: winnerId }).eq('id', bracketEntry.id)
      if (nextGameId) {
        const { data: nextBracket } = await supabase
          .from('playoff_bracket').select('*').eq('game_id', nextGameId).maybeSingle()
        if (nextBracket) {
          await supabase.from('playoff_bracket').update({ [nextSlot]: winnerId }).eq('id', nextBracket.id)
        }
      }
    }

    redirect('/admin/games')
  }

  const playoffRounds = ['wildcard', 'semifinal', 'final']
  const regularGames = (games ?? []).filter((g: any) => g.game_type === 'regular_season')
  const playoffGames = (games ?? []).filter((g: any) => playoffRounds.includes(g.game_type))

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

      {/* ── Playoffs ── */}
      {playoffGames.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-3 flex items-center gap-2">
            🏆 Playoffs
            <span className="text-[#333] font-normal normal-case tracking-normal">
              — Gewinner mit &quot;Advance →&quot; in nächste Runde setzen
            </span>
          </h2>
          <div className="space-y-2">
            {playoffGames.map((game: any) => {
              const bEntry = bracketByGameId[game.id]
              const alreadyAdvanced = !!bEntry?.winner_id
              const canAdvance = game.status === 'final' && !alreadyAdvanced && game.game_type !== 'final'
              const isFinal = game.status === 'final'
              const isLive = game.status === 'live'
              const winnerTeamId = bEntry?.winner_id
              const homeWon = winnerTeamId === game.home_team_id
              const awayWon = winnerTeamId === game.away_team_id

              return (
                <div key={game.id} className={`bg-[#111] border rounded-xl p-4 ${isLive ? 'border-[#ff1d25]/40' : alreadyAdvanced ? 'border-[#04a550]/20' : 'border-white/5'}`}>
                  <div className="flex flex-wrap items-center gap-4">

                    {/* Round badge */}
                    <div className="shrink-0">
                      <span className="text-[10px] font-bold tracking-widest px-2 py-1 rounded uppercase"
                        style={{
                          background: game.game_type === 'final' ? 'rgba(255,29,37,0.12)' : 'rgba(255,255,255,0.05)',
                          color: game.game_type === 'final' ? '#ff1d25' : '#666',
                        }}>
                        {ROUND_LABEL[game.game_type] ?? game.game_type}
                      </span>
                    </div>

                    {/* Teams & score */}
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <div className="text-center min-w-[100px]">
                        <div className="font-bold text-sm">
                          <span className={homeWon ? 'text-[#04a550]' : ''}>{game.home_team?.short_name ?? 'TBD'}</span>
                          {homeWon && <span className="ml-1 text-[#04a550]">✓</span>}
                          <span className="text-[#7a7a7a] mx-1">vs</span>
                          <span className={awayWon ? 'text-[#04a550]' : ''}>{game.away_team?.short_name ?? 'TBD'}</span>
                          {awayWon && <span className="ml-1 text-[#04a550]">✓</span>}
                        </div>
                        <div className="text-xs text-[#555]">{game.scheduled_at ? new Date(game.scheduled_at).toLocaleDateString('de-AT') : 'Datum TBD'}</div>
                      </div>

                      {(isFinal || isLive) && (
                        <div className="font-black text-lg">
                          {game.home_score ?? 0} – {game.away_score ?? 0}
                        </div>
                      )}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        isLive ? 'bg-[#ff1d25]/20 text-[#ff1d25]' :
                        isFinal ? 'bg-[#04a550]/20 text-[#04a550]' :
                        'bg-white/5 text-[#7a7a7a]'
                      }`}>
                        {isLive && <span className="animate-pulse mr-1">●</span>}
                        {game.status}
                      </span>

                      {/* Score update form */}
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

                      {/* Advance winner button */}
                      {canAdvance && (
                        <form action={advanceWinner}>
                          <input type="hidden" name="game_id" value={game.id} />
                          <button type="submit"
                            className="text-xs font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
                            style={{ background: 'rgba(4,165,80,0.15)', color: '#04a550', border: '1px solid rgba(4,165,80,0.3)' }}>
                            Advance Winner →
                          </button>
                        </form>
                      )}

                      {alreadyAdvanced && game.game_type !== 'final' && (
                        <span className="text-[10px] text-[#04a550] font-bold tracking-wider">✓ ADVANCED</span>
                      )}

                      {/* Track stats link */}
                      {(isLive || game.status === 'scheduled') ? (
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
              )
            })}
          </div>
        </div>
      )}

      {/* ── Regular Season ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-3">Regular Season</h2>
        <div className="space-y-2">
          {regularGames.map((game: any) => {
            const isFinal = game.status === 'final'
            const isLive = game.status === 'live'
            return (
              <div key={game.id} className={`bg-[#111] border rounded-xl p-4 ${isLive ? 'border-[#ff1d25]/40' : 'border-white/5'}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <div className="text-center min-w-[80px]">
                      <div className="font-bold text-sm">
                        {game.home_team?.short_name ?? 'TBD'}
                        <span className="text-[#7a7a7a] mx-1">vs</span>
                        {game.away_team?.short_name ?? 'TBD'}
                      </div>
                      <div className="text-xs text-[#7a7a7a]">Week {game.week ?? '?'}</div>
                    </div>

                    {(isFinal || isLive) && (
                      <div className="font-black text-lg">
                        {game.home_score ?? 0} – {game.away_score ?? 0}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      isLive ? 'bg-[#ff1d25]/20 text-[#ff1d25]' :
                      isFinal ? 'bg-[#04a550]/20 text-[#04a550]' :
                      'bg-white/5 text-[#7a7a7a]'
                    }`}>
                      {isLive && <span className="animate-pulse mr-1">●</span>}
                      {game.status}
                    </span>

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

                    {isLive || game.status === 'scheduled' ? (
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
            )
          })}
        </div>
      </div>
    </div>
  )
}
