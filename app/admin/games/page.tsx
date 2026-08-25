import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import TeamBadge from '@/components/TeamBadge'
import GameStatsDownloadButton from '@/components/GameStatsDownloadButton'
import { getSelectedSeason } from '@/lib/season'
import { computeRecords } from '@/lib/records'

const STATUS_OPTIONS = ['scheduled', 'live', 'final']
const PLAYOFF_TYPES = ['wildcard', 'semifinal', 'third_place', 'final']

const GAME_TYPE_LABELS: Record<string, string> = {
  regular_season: 'Regular Season',
  wildcard: 'Wildcard',
  semifinal: 'Semifinal',
  third_place: 'Spiel um Platz 3',
  final: 'Championship',
}

type StageGroup = { stage: string; date: string | null; city: string | null; venue: string | null; games: any[] }

function groupByStage(games: any[]): StageGroup[] {
  const groups: StageGroup[] = []
  const index = new Map<string, StageGroup>()
  for (const g of games) {
    const dateKey = g.scheduled_at ? new Date(g.scheduled_at).toISOString().slice(0, 10) : 'tbd'
    const stage = g.stage || GAME_TYPE_LABELS[g.game_type] || g.game_type
    const key = `${stage}__${dateKey}`
    if (!index.has(key)) {
      const grp: StageGroup = { stage, date: g.scheduled_at, city: g.city, venue: g.location, games: [] }
      index.set(key, grp)
      groups.push(grp)
    }
    index.get(key)!.games.push(g)
  }
  return groups
}

export default async function AdminGamesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const season = await getSelectedSeason()

  const [{ data: games }, { data: bracket }] = await Promise.all([
    supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
      .eq('season', season)
      .order('scheduled_at', { nullsFirst: false }),
    supabase.from('playoff_bracket').select('*').eq('season', season),
  ])

  // Map: game_id → bracket entry (winner_id tells us if already advanced)
  const bracketByGameId: Record<string, any> = {}
  ;(bracket ?? []).forEach((b: any) => { if (b.game_id) bracketByGameId[b.game_id] = b })

  const allGames = (games ?? []) as any[]
  const recordByTeam = computeRecords(allGames)

  /* ─── Server actions ─── */

  async function updateGameStatus(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const gameId = formData.get('game_id') as string
    if (!/^[0-9a-f-]{36}$/i.test(gameId)) return

    const status = formData.get('status') as string
    if (!STATUS_OPTIONS.includes(status)) return

    const rawHome = formData.get('home_score')
    const rawAway = formData.get('away_score')
    const homeScore = rawHome ? Number(rawHome) : null
    const awayScore = rawAway ? Number(rawAway) : null
    if (homeScore !== null && (!Number.isInteger(homeScore) || homeScore < 0 || homeScore > 999)) return
    if (awayScore !== null && (!Number.isInteger(awayScore) || awayScore < 0 || awayScore > 999)) return

    await supabase.from('games').update({ status, home_score: homeScore, away_score: awayScore }).eq('id', gameId)
    redirect('/admin/games')
  }

  /* Save livestream + highlights links. Empty clears the field; a non-empty
     value must be an http(s) URL — invalid input is ignored (field unchanged). */
  async function updateGameMedia(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const gameId = formData.get('game_id') as string
    if (!/^[0-9a-f-]{36}$/i.test(gameId)) return

    const rawLs = ((formData.get('livestream_url') as string | null) ?? '').trim()
    const rawHl = ((formData.get('highlights_url') as string | null) ?? '').trim()

    const update: Record<string, string | null> = {}
    if (rawLs === '' || /^https?:\/\//i.test(rawLs)) update.livestream_url = rawLs ? rawLs.slice(0, 500) : null
    if (rawHl === '' || /^https?:\/\//i.test(rawHl)) update.highlights_url = rawHl ? rawHl.slice(0, 500) : null

    if (Object.keys(update).length) await supabase.from('games').update(update).eq('id', gameId)
    redirect('/admin/games')
  }

  /**
   * Advance results of a wildcard or semifinal game.
   *
   * Wildcard (sorted by date):
   *   #0 → semifinal #1 (AWAY slot)   ← reversed cross-bracket
   *   #1 → semifinal #0 (AWAY slot)
   *
   * Semifinal (sorted by date):
   *   #0 winner → final HOME,      loser → 3rd place HOME
   *   #1 winner → final AWAY,      loser → 3rd place AWAY
   *
   * Also syncs playoff_bracket rows when linked via game_id.
   */
  async function advanceWinner(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const gameId = formData.get('game_id') as string
    if (!/^[0-9a-f-]{36}$/i.test(gameId)) return

    const { data: game } = await supabase.from('games').select('*').eq('id', gameId).single()
    if (!game || game.status !== 'final') { redirect('/admin/games'); return }

    const currentRound = game.game_type as string
    if (!['wildcard', 'semifinal', 'final', 'third_place'].includes(currentRound)) { redirect('/admin/games'); return }

    const winnerId = (game.home_score ?? 0) >= (game.away_score ?? 0)
      ? game.home_team_id : game.away_team_id
    if (!winnerId) { redirect('/admin/games'); return }

    // Final / 3rd place have no next round — just record the winner (final → champion)
    if (['final', 'third_place'].includes(currentRound)) {
      const { data: be } = await supabase.from('playoff_bracket').select('id').eq('game_id', gameId).maybeSingle()
      if (be) await supabase.from('playoff_bracket').update({ winner_id: winnerId }).eq('id', be.id)
      redirect('/admin/games')
      return
    }

    const loserId = winnerId === game.home_team_id ? game.away_team_id : game.home_team_id

    // Position among same-round games sorted by date
    const { data: sameRound } = await supabase
      .from('games').select('id')
      .eq('season', game.season).eq('game_type', currentRound)
      .order('scheduled_at', { nullsFirst: false })
    const posIdx = (sameRound ?? []).findIndex((g: any) => g.id === gameId)
    const total = (sameRound ?? []).length

    // Helper: update a game + its bracket entry
    async function setTeam(round: string, gameIdx: number, slot: 'home_team_id' | 'away_team_id', teamId: string | null) {
      const { data: roundGames } = await supabase
        .from('games').select('id')
        .eq('season', game.season).eq('game_type', round)
        .order('scheduled_at', { nullsFirst: false })
      const targetGameId = (roundGames ?? [])[gameIdx]?.id
      if (!targetGameId) return
      await supabase.from('games').update({ [slot]: teamId }).eq('id', targetGameId)
      const { data: bracketRow } = await supabase
        .from('playoff_bracket').select('*').eq('game_id', targetGameId).maybeSingle()
      if (bracketRow) {
        await supabase.from('playoff_bracket').update({ [slot]: teamId }).eq('id', bracketRow.id)
      }
    }

    if (currentRound === 'wildcard') {
      // Cross-bracket: wildcard #0 → semi #1 away, wildcard #1 → semi #0 away
      const semiIdx = total - 1 - posIdx
      await setTeam('semifinal', semiIdx, 'away_team_id', winnerId)

      const { data: be } = await supabase.from('playoff_bracket').select('*').eq('game_id', gameId).maybeSingle()
      if (be) await supabase.from('playoff_bracket').update({ winner_id: winnerId }).eq('id', be.id)

    } else {
      const slot: 'home_team_id' | 'away_team_id' = posIdx === 0 ? 'home_team_id' : 'away_team_id'

      await setTeam('final', 0, slot, winnerId)
      await setTeam('third_place', 0, slot, loserId)

      const { data: be } = await supabase.from('playoff_bracket').select('*').eq('game_id', gameId).maybeSingle()
      if (be) await supabase.from('playoff_bracket').update({ winner_id: winnerId }).eq('id', be.id)
    }

    redirect('/admin/games')
  }

  /* ─── Per-game card (schedule-style) with admin controls ─── */
  function GameCard(game: any) {
    const bEntry = bracketByGameId[game.id]
    const isPlayoff = PLAYOFF_TYPES.includes(game.game_type)
    const alreadyAdvanced = !!bEntry?.winner_id
    const canAdvance = isPlayoff && game.status === 'final' && !alreadyAdvanced
    const isFinal = game.status === 'final'
    const isLive = game.status === 'live'
    const homeWon = bEntry?.winner_id === game.home_team_id
    const awayWon = bEntry?.winner_id === game.away_team_id
    const status = isLive ? 'live' : isFinal ? 'final' : 'scheduled'
    const statusColor = isLive ? '#ff1d25' : isFinal ? '#04a550' : '#7a7a7a'

    const inputCls = 'bg-[#f7f8fa] dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 rounded px-1.5 py-1 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#ff1d25]'

    return (
      <div key={game.id}
        className={`bg-white dark:bg-[#111] border rounded-xl p-4 shadow-sm ${isLive ? 'border-[#ff1d25]/40' : alreadyAdvanced ? 'border-[#04a550]/20' : 'border-black/[0.07] dark:border-white/5'}`}>

        {/* Matchup */}
        <div className="flex items-center gap-4">
          <div className="w-14 text-center shrink-0 text-sm font-bold text-slate-900 dark:text-white tabular-nums">
            {game.scheduled_at
              ? new Date(game.scheduled_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
              : 'TBD'}
          </div>

          <div className="flex-1 flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 justify-end">
              <TeamBadge team={game.home_team} size="sm" />
              <span className={`font-semibold text-sm ${homeWon ? 'text-[#04a550]' : 'text-slate-900 dark:text-white'}`}>{game.home_team?.short_name ?? 'TBD'}</span>
              {homeWon && <span className="text-[#04a550]">✓</span>}
              <span className="text-[11px] text-slate-400 dark:text-[#7a7a7a] tabular-nums">{recordByTeam[game.home_team_id] ?? '0-0'}</span>
            </div>
            <div className="text-center min-w-[76px]">
              {isFinal || isLive ? (
                <div className="font-black text-lg text-slate-900 dark:text-white">
                  {game.home_score ?? 0}<span className="text-slate-400 dark:text-[#7a7a7a] mx-1">–</span>{game.away_score ?? 0}
                </div>
              ) : (
                <span className="text-slate-400 dark:text-[#7a7a7a] text-xs">vs</span>
              )}
              <div className="text-xs font-semibold" style={{ color: statusColor }}>
                {isLive && <span className="animate-pulse mr-1">●</span>}{status}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[11px] text-slate-400 dark:text-[#7a7a7a] tabular-nums">{recordByTeam[game.away_team_id] ?? '0-0'}</span>
              {awayWon && <span className="text-[#04a550]">✓</span>}
              <span className={`font-semibold text-sm ${awayWon ? 'text-[#04a550]' : 'text-slate-900 dark:text-white'}`}>{game.away_team?.short_name ?? 'TBD'}</span>
              <TeamBadge team={game.away_team} size="sm" />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/5 flex flex-wrap items-center gap-2">
          <form action={updateGameStatus} className="flex items-center gap-2">
            <input type="hidden" name="game_id" value={game.id} />
            <input name="home_score" type="number" defaultValue={game.home_score ?? ''} placeholder="H" className={`w-12 text-center ${inputCls}`} />
            <input name="away_score" type="number" defaultValue={game.away_score ?? ''} placeholder="A" className={`w-12 text-center ${inputCls}`} />
            <select name="status" defaultValue={game.status} className={inputCls}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="submit" className="text-xs text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white border border-black/10 dark:border-white/10 px-2 py-1 rounded transition-colors">
              Save
            </button>
          </form>

          {canAdvance && (
            <form action={advanceWinner}>
              <input type="hidden" name="game_id" value={game.id} />
              <button type="submit"
                className="text-xs font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
                style={{ background: 'rgba(4,165,80,0.15)', color: '#04a550', border: '1px solid rgba(4,165,80,0.3)' }}>
                {game.game_type === 'final' ? 'Champion festlegen 🏆' : game.game_type === 'third_place' ? 'Sieger festlegen' : 'Advance Winner →'}
              </button>
            </form>
          )}
          {alreadyAdvanced && (
            <span className="text-[10px] text-[#04a550] font-bold tracking-wider">
              {game.game_type === 'final' ? '✓ CHAMPION' : '✓ ADVANCED'}
            </span>
          )}

          {/* Live view link — greyed unless the game is live */}
          {isLive ? (
            <Link href="/live" className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded bg-[#ff1d25] text-white hover:bg-[#e0181f] transition-colors">
              <span className="animate-pulse">●</span> Live
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded bg-black/[0.04] dark:bg-white/[0.04] text-slate-300 dark:text-[#555] cursor-not-allowed select-none">
              ● Live
            </span>
          )}

          {isLive || game.status === 'scheduled' ? (
            <Link href={`/admin/games/${game.id}/track`}
              className="bg-[#ff1d25] text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-[#e0181f] transition-colors">
              Track Stats
            </Link>
          ) : (
            <Link href={`/admin/games/${game.id}/track`}
              className="text-xs text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white border border-black/10 dark:border-white/10 px-3 py-1.5 rounded transition-colors">
              View Stats
            </Link>
          )}
          <GameStatsDownloadButton
            gameId={game.id}
            label={`${game.home_team?.short_name ?? 'H'}-vs-${game.away_team?.short_name ?? 'A'}`}
          />
        </div>

        {/* Media links: livestream (for live) + highlights (for finished) */}
        <form action={updateGameMedia} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="game_id" value={game.id} />
          <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555] w-16 shrink-0">Stream</span>
            <input name="livestream_url" type="url" defaultValue={game.livestream_url ?? ''} placeholder="YouTube / Twitch / Vimeo Link" className={`flex-1 ${inputCls}`} />
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#555] w-16 shrink-0">Highlights</span>
            <input name="highlights_url" type="url" defaultValue={game.highlights_url ?? ''} placeholder="Highlights-Video Link" className={`flex-1 ${inputCls}`} />
          </div>
          <button type="submit" className="text-xs font-bold text-white bg-slate-700 dark:bg-white/10 hover:bg-slate-900 dark:hover:bg-white/20 px-3 py-1.5 rounded transition-colors">
            Links speichern
          </button>
        </form>
      </div>
    )
  }

  function GroupList({ groups }: { groups: StageGroup[] }) {
    if (groups.length === 0) {
      return <div className="text-sm text-slate-400 dark:text-[#555]">Keine Spiele.</div>
    }
    return (
      <div className="space-y-8">
        {groups.map((grp, gi) => (
          <div key={gi}>
            <div className="mb-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{grp.stage}</h3>
              <div className="text-xs text-slate-500 dark:text-[#7a7a7a] mt-0.5">
                {grp.date && new Date(grp.date).toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                {grp.city && <> · {grp.city}</>}
                {grp.venue && <> · {grp.venue}</>}
              </div>
            </div>
            <div className="space-y-2">
              {grp.games.map((g: any) => GameCard(g))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // One chronological list: the next matchday on top, then in order,
  // with fully-completed matchdays sinking to the bottom.
  const groups = groupByStage(allGames)
  const upcoming = groups.filter(g => g.games.some((x: any) => x.status !== 'final'))
  const done = groups.filter(g => g.games.every((x: any) => x.status === 'final'))
  const ordered = [...upcoming, ...done]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Game Management <span className="text-slate-400 dark:text-[#7a7a7a] font-bold">{season}</span></h1>
      </div>
      <p className="text-xs text-slate-500 dark:text-[#7a7a7a] mb-6">
        Nächster Spieltag oben · abgeschlossene Spieltage unten · Playoff-Sieger mit &quot;Advance →&quot; weitersetzen
      </p>

      <GroupList groups={ordered} />
    </div>
  )
}
