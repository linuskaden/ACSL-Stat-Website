import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'
import { notFound } from 'next/navigation'
import { competitionById } from '@/lib/competition'
import FootballBoxScore from '@/components/FootballBoxScore'
import BballBoxScore from '@/components/BballBoxScore'

export const revalidate = 30

export default async function BoxScorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: game } = await supabase
    .from('games')
    .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
    .eq('id', id)
    .single()

  if (!game) notFound()

  const g = game as any
  const sport = competitionById(g.competition_id)?.sport ?? 'football'
  const statsTable = sport === 'basketball' ? 'bball_game_stats' : 'game_stats'

  const { data: rawStats } = await supabase
    .from(statsTable)
    .select('*, player:players(id, first_name, last_name, positions)')
    .eq('game_id', id)

  const stats = (rawStats ?? []) as any[]
  const hasStats = stats.length > 0

  const isFinal = g.status === 'final'
  const isLive = g.status === 'live'

  const gameDate = g.scheduled_at
    ? new Date(g.scheduled_at).toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })
    : null

  const GAME_TYPE_LABELS: Record<string, string> = {
    regular_season: 'Regular Season',
    wildcard: 'Wildcard',
    semifinal: 'Semifinal',
    third_place: 'Spiel um Platz 3',
    final: 'Championship',
  }
  const gameTypeLabel = GAME_TYPE_LABELS[g.game_type] ?? g.game_type

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Back */}
      <Link href="/schedule" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-[#7a7a7a] hover:text-[#ff1d25] transition-colors mb-6">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Schedule
      </Link>

      {/* Game Header */}
      <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl p-6 shadow-sm mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-4 flex items-center gap-3">
          <span>{gameTypeLabel}</span>
          {gameDate && <><span className="text-slate-300 dark:text-[#444]">·</span><span>{gameDate}</span></>}
          {g.location && <><span className="text-slate-300 dark:text-[#444]">·</span><span>{g.location}</span></>}
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Home team */}
          <div className="flex items-center gap-3 flex-1">
            {g.home_team && <TeamBadge team={g.home_team} size="lg" />}
            <div>
              <div className="font-black text-xl text-slate-900 dark:text-white">{g.home_team?.short_name ?? '—'}</div>
              <div className="text-xs text-slate-400 dark:text-[#555]">{g.home_team?.name ?? ''}</div>
            </div>
          </div>

          {/* Score */}
          <div className="text-center shrink-0 px-6">
            {(isFinal || isLive) ? (
              <div className="flex items-center gap-3">
                <span className="font-black text-5xl text-slate-900 dark:text-white tabular-nums">{g.home_score ?? 0}</span>
                <span className="text-slate-300 dark:text-[#444] text-2xl font-light">–</span>
                <span className="font-black text-5xl text-slate-900 dark:text-white tabular-nums">{g.away_score ?? 0}</span>
              </div>
            ) : (
              <span className="text-slate-400 dark:text-[#555] font-semibold">vs</span>
            )}
            <div className="mt-1 text-xs font-semibold" style={{ color: isFinal ? '#04a550' : isLive ? '#ff1d25' : '#7a7a7a' }}>
              {isLive && <span className="animate-pulse mr-1">●</span>}
              {isFinal ? 'Final' : isLive ? 'LIVE' : 'Upcoming'}
            </div>
          </div>

          {/* Away team */}
          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="text-right">
              <div className="font-black text-xl text-slate-900 dark:text-white">{g.away_team?.short_name ?? '—'}</div>
              <div className="text-xs text-slate-400 dark:text-[#555]">{g.away_team?.name ?? ''}</div>
            </div>
            {g.away_team && <TeamBadge team={g.away_team} size="lg" />}
          </div>
        </div>
      </div>

      {/* Highlights */}
      {isFinal && g.highlights_url && (
        <div className="mb-6 -mt-2">
          <a href={g.highlights_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff1d25] text-white text-sm font-bold hover:bg-[#e0181f] transition-colors shadow-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Highlights ansehen
          </a>
        </div>
      )}

      {/* No stats yet */}
      {!hasStats && (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-10 text-center text-slate-400 dark:text-[#555] text-sm shadow-sm">
          No stats available yet.
        </div>
      )}

      {hasStats && (sport === 'basketball'
        ? <BballBoxScore g={g} stats={stats} />
        : <FootballBoxScore g={g} stats={stats} />
      )}
    </div>
  )
}
