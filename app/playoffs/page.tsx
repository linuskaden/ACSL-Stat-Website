import { createClient } from '@/lib/supabase/server'
import TeamBadge from '@/components/TeamBadge'

export const revalidate = 30

export default async function PlayoffsPage() {
  const supabase = await createClient()
  const { data: bracket } = await supabase
    .from('playoff_bracket')
    .select('*, home_team:teams!playoff_bracket_home_team_id_fkey(*), away_team:teams!playoff_bracket_away_team_id_fkey(*), winner:teams!playoff_bracket_winner_id_fkey(*)')
    .eq('season', 2026)
    .order('round')
    .order('match_order')

  const wildcardGames = bracket?.filter(b => b.round === 'wildcard') ?? []
  const semifinalGames = bracket?.filter(b => b.round === 'semifinal') ?? []
  const finalGames = bracket?.filter(b => b.round === 'final') ?? []

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-black mb-2">Playoff Bracket 2026</h1>
      <p className="text-[#7a7a7a] text-sm mb-8">
        Wildcard: #3 vs #6, #4 vs #5 → Semifinals: Winners vs #1 and #2 → Championship
      </p>

      {(!bracket || bracket.length === 0) && (
        <div className="bg-[#111] border border-white/5 rounded-xl p-8 text-center text-[#7a7a7a]">
          Playoff bracket will appear after the regular season.
        </div>
      )}

      {bracket && bracket.length > 0 && (
        <div className="flex flex-col lg:flex-row items-start gap-6 overflow-x-auto">
          {/* Wildcard */}
          <BracketRound title="Wildcard Round" games={wildcardGames} />

          {/* Arrow */}
          <div className="hidden lg:flex items-center self-center text-[#7a7a7a] text-2xl">→</div>

          {/* Semifinals */}
          <BracketRound title="Semifinals" games={semifinalGames} />

          {/* Arrow */}
          <div className="hidden lg:flex items-center self-center text-[#7a7a7a] text-2xl">→</div>

          {/* Final */}
          <BracketRound title="Championship" games={finalGames} highlight />
        </div>
      )}
    </div>
  )
}

function BracketRound({ title, games, highlight = false }: { title: string; games: any[]; highlight?: boolean }) {
  return (
    <div className="flex-1 min-w-[220px]">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-3 text-center">{title}</h2>
      <div className="space-y-3">
        {games.length === 0 ? (
          <div className="bg-[#111] border border-white/5 rounded-xl p-4 text-center text-[#7a7a7a] text-xs">TBD</div>
        ) : games.map((game: any) => (
          <BracketGame key={game.id} game={game} highlight={highlight} />
        ))}
      </div>
    </div>
  )
}

function BracketGame({ game, highlight }: { game: any; highlight: boolean }) {
  const homeWon = game.winner_id === game.home_team_id
  const awayWon = game.winner_id === game.away_team_id

  return (
    <div className={`bg-[#111] rounded-xl overflow-hidden border ${highlight ? 'border-[#ff1d25]/40' : 'border-white/5'}`}>
      {[
        { team: game.home_team, seed: game.home_seed, won: homeWon },
        { team: game.away_team, seed: game.away_seed, won: awayWon },
      ].map((row, i) => (
        <div key={i}
          className={`flex items-center gap-3 px-3 py-2.5 ${i === 0 ? 'border-b border-white/5' : ''} ${row.won ? 'bg-white/[0.04]' : ''}`}>
          {row.seed && (
            <span className="text-xs text-[#7a7a7a] w-4 text-center font-mono">{row.seed}</span>
          )}
          {row.team ? (
            <>
              <TeamBadge team={row.team} size="sm" />
              <span className={`text-sm flex-1 ${row.won ? 'font-bold text-white' : 'text-[#7a7a7a]'}`}>
                {row.team.short_name}
              </span>
            </>
          ) : (
            <span className="text-sm text-[#7a7a7a] flex-1">TBD</span>
          )}
          {row.won && <span className="text-[#04a550] text-xs font-bold">✓</span>}
        </div>
      ))}
    </div>
  )
}
