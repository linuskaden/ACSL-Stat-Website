import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'

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
      {/* Back */}
      {team && (
        <Link href={`/teams/${team.slug}`} className="text-xs text-[#7a7a7a] hover:text-white mb-4 inline-flex items-center gap-1">
          ← {team.name}
        </Link>
      )}

      {/* Header */}
      <div className="bg-[#111] border border-white/5 rounded-2xl p-6 mb-6 flex flex-wrap gap-6">
        {team && (
          <div className="flex items-center gap-4">
            <TeamBadge team={team} size="lg" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3">
            {player.jersey_number && (
              <span className="text-5xl font-black" style={{ color: team?.primary_color ?? '#ff1d25' }}>
                #{player.jersey_number}
              </span>
            )}
            <h1 className="text-3xl font-black">{player.first_name} {player.last_name}</h1>
            {player.nickname && <span className="text-[#7a7a7a]">"{player.nickname}"</span>}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {(player.positions as string[]).map((pos: string) => (
              <span key={pos} className="bg-white/10 text-white text-xs px-2 py-0.5 rounded font-semibold">{pos}</span>
            ))}
            {team && <span className="text-[#7a7a7a] text-sm">{team.name}</span>}
          </div>

          {/* Bio grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {player.height_cm && <Stat label="Height" value={`${player.height_cm} cm`} />}
            {player.weight_kg && <Stat label="Weight" value={`${player.weight_kg} kg`} />}
            {player.country && <Stat label="Country" value={player.country} />}
            {player.hometown && <Stat label="Hometown" value={player.hometown} />}
            {player.field_of_study && <Stat label="Study" value={player.field_of_study} />}
            {player.semester && <Stat label="Semester" value={player.semester} />}
            {player.acsl_since && <Stat label="ACSL Since" value={player.acsl_since} />}
          </div>

          {player.fun_fact && (
            <div className="mt-4 bg-white/5 rounded-lg px-4 py-2.5 text-sm text-[#7a7a7a] italic">
              "{player.fun_fact}"
            </div>
          )}
          {player.football_experience && (
            <div className="mt-2 text-xs text-[#7a7a7a]">
              <span className="text-white font-medium">Football Exp: </span>{player.football_experience}
            </div>
          )}
        </div>
      </div>

      {/* Career stats */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-3">Career Stats</h2>
        {!career?.length ? (
          <div className="bg-[#111] border border-white/5 rounded-xl p-6 text-center text-[#7a7a7a] text-sm">
            No stats recorded yet.
          </div>
        ) : career.map(cs => (
          <div key={cs.id} className="bg-[#111] border border-white/5 rounded-xl p-5 mb-3">
            <h3 className="font-bold mb-3 text-sm">Season {cs.season}</h3>
            <CareerStatsGrid cs={cs} positions={player.positions} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[#7a7a7a] uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-white mt-0.5 truncate">{value}</div>
    </div>
  )
}

function CareerStatsGrid({ cs, positions }: { cs: any; positions: string[] }) {
  const stats: { label: string; value: string | number }[] = []

  if (positions.includes('QB')) {
    stats.push(
      { label: 'Pass YDS', value: cs.pass_yards },
      { label: 'Pass TDs', value: cs.pass_tds },
      { label: 'Comp/Att', value: `${cs.pass_completions}/${cs.pass_attempts}` },
      { label: 'INT', value: cs.interceptions_thrown },
      { label: 'Rush YDS', value: cs.qb_rush_yards },
      { label: 'Rush TDs', value: cs.qb_rush_tds },
    )
  }
  if (positions.includes('RB')) {
    stats.push(
      { label: 'Carries', value: cs.rush_carries },
      { label: 'Rush YDS', value: cs.rush_yards },
      { label: 'Rush TDs', value: cs.rush_tds },
      { label: 'Rec YDS', value: cs.rb_rec_yards },
      { label: 'Rec', value: cs.rb_receptions },
      { label: 'Fumbles', value: cs.rb_fumbles },
    )
  }
  if (positions.some((p: string) => ['WR', 'TE'].includes(p))) {
    stats.push(
      { label: 'Rec YDS', value: cs.rec_yards },
      { label: 'Rec', value: cs.receptions },
      { label: 'Rec TDs', value: cs.rec_tds },
      { label: 'Targets', value: cs.rec_targets },
      { label: 'Fumbles', value: cs.rec_fumbles },
    )
  }
  if (positions.some((p: string) => ['DL', 'LB', 'DB'].includes(p))) {
    stats.push(
      { label: 'Sacks', value: cs.sacks },
      { label: 'INT', value: cs.def_interceptions },
    )
  }
  if (positions.some((p: string) => ['K', 'P'].includes(p))) {
    stats.push(
      { label: 'FG M/A', value: `${cs.fg_made}/${cs.fg_attempts}` },
      { label: 'EP M/A', value: `${cs.ep_made}/${cs.ep_attempts}` },
      { label: 'Points', value: cs.fg_made * 3 + cs.ep_made },
    )
  }

  if (stats.length === 0) {
    stats.push(
      { label: 'Sacks', value: cs.sacks },
      { label: 'INT', value: cs.def_interceptions },
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-1 text-xs text-[#7a7a7a]">
        <span>GP: {cs.games_played}</span>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {stats.map(s => (
          <div key={s.label} className="text-center">
            <div className="text-lg font-black text-white">{s.value}</div>
            <div className="text-xs text-[#7a7a7a] uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
