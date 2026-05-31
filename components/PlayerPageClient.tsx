'use client'
import { useState } from 'react'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'

/* ─── Helpers ─── */
function calcAvg(value: number, gp: number): string {
  if (!gp) return '—'
  return (value / gp).toFixed(1)
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[#7a7a7a] uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-white mt-0.5 truncate">{value}</div>
    </div>
  )
}

/* ─── Career Averages Grid (per game) ─── */
function CareerAveragesGrid({ cs, positions }: { cs: any; positions: string[] }) {
  const gp = cs.games_played ?? 0
  const stats: { label: string; value: string }[] = []

  if (positions.includes('QB')) {
    stats.push(
      { label: 'Pass YDS/G', value: calcAvg(cs.pass_yards ?? 0, gp) },
      { label: 'Pass TDs/G', value: calcAvg(cs.pass_tds ?? 0, gp) },
      { label: 'Comp/G',     value: calcAvg(cs.pass_completions ?? 0, gp) },
      { label: 'Att/G',      value: calcAvg(cs.pass_attempts ?? 0, gp) },
      { label: 'INT/G',      value: calcAvg(cs.interceptions_thrown ?? 0, gp) },
      { label: 'Rush YDS/G', value: calcAvg(cs.qb_rush_yards ?? 0, gp) },
    )
  }
  if (positions.includes('RB')) {
    stats.push(
      { label: 'Carries/G',  value: calcAvg(cs.rush_carries ?? 0, gp) },
      { label: 'Rush YDS/G', value: calcAvg(cs.rush_yards ?? 0, gp) },
      { label: 'Rush TDs/G', value: calcAvg(cs.rush_tds ?? 0, gp) },
      { label: 'Rec YDS/G',  value: calcAvg(cs.rb_rec_yards ?? 0, gp) },
      { label: 'Rec/G',      value: calcAvg(cs.rb_receptions ?? 0, gp) },
    )
  }
  if (positions.some((p: string) => ['WR', 'TE'].includes(p))) {
    stats.push(
      { label: 'Rec YDS/G', value: calcAvg(cs.rec_yards ?? 0, gp) },
      { label: 'Rec/G',     value: calcAvg(cs.receptions ?? 0, gp) },
      { label: 'Rec TDs/G', value: calcAvg(cs.rec_tds ?? 0, gp) },
      { label: 'Targets/G', value: calcAvg(cs.rec_targets ?? 0, gp) },
    )
  }
  if (positions.some((p: string) => ['DL', 'LB', 'DB'].includes(p))) {
    stats.push(
      { label: 'Sacks/G', value: calcAvg(cs.sacks ?? 0, gp) },
      { label: 'INT/G',   value: calcAvg(cs.def_interceptions ?? 0, gp) },
    )
  }
  if (positions.some((p: string) => ['K', 'P'].includes(p))) {
    stats.push(
      { label: 'FGM/G', value: calcAvg(cs.fg_made ?? 0, gp) },
      { label: 'FGA/G', value: calcAvg(cs.fg_attempts ?? 0, gp) },
      { label: 'EPM/G', value: calcAvg(cs.ep_made ?? 0, gp) },
    )
  }
  if (stats.length === 0) {
    stats.push(
      { label: 'Sacks/G', value: calcAvg(cs.sacks ?? 0, gp) },
      { label: 'INT/G',   value: calcAvg(cs.def_interceptions ?? 0, gp) },
    )
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-1 text-xs text-[#7a7a7a]">
        <span>GP: {gp}</span>
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

/* ─── Main Client Component ─── */
export default function PlayerPageClient({
  player,
  team,
  career,
}: {
  player: any
  team: any
  career: any[]
}) {
  const [tab, setTab] = useState<'profile' | 'stats'>('profile')
  const pos: string[] = player.positions ?? []

  return (
    <div>
      {/* Tab nav */}
      <div className="flex gap-1 mb-5">
        <button
          onClick={() => setTab('profile')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'profile' ? 'bg-white/10 text-white' : 'text-[#7a7a7a] hover:text-white'
          }`}
        >
          Profil
        </button>
        <button
          onClick={() => setTab('stats')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'stats' ? 'bg-white/10 text-white' : 'text-[#7a7a7a] hover:text-white'
          }`}
        >
          Career Stats
        </button>
      </div>

      {/* ── Profil Tab ── */}
      {tab === 'profile' && (
        <div className="bg-[#111] border border-white/5 rounded-2xl p-6">
          {team && (
            <div className="flex items-center gap-4 mb-4">
              <TeamBadge team={team} size="lg" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              {player.jersey_number && (
                <span className="text-5xl font-black" style={{ color: team?.primary_color ?? '#ff1d25' }}>
                  #{player.jersey_number}
                </span>
              )}
              <h1 className="text-3xl font-black">{player.first_name} {player.last_name}</h1>
              {player.nickname && <span className="text-[#7a7a7a]">"{player.nickname}"</span>}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {pos.map((p: string) => (
                <span key={p} className="bg-white/10 text-white text-xs px-2 py-0.5 rounded font-semibold">{p}</span>
              ))}
              {team && <span className="text-[#7a7a7a] text-sm">{team.name}</span>}
            </div>

            {/* Bio grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {player.height_cm   && <Stat label="Height"   value={`${player.height_cm} cm`} />}
              {player.weight_kg   && <Stat label="Weight"   value={`${player.weight_kg} kg`} />}
              {player.country     && <Stat label="Country"  value={player.country} />}
              {player.hometown    && <Stat label="Hometown" value={player.hometown} />}
              {player.field_of_study && <Stat label="Study"    value={player.field_of_study} />}
              {player.semester    && <Stat label="Semester" value={player.semester} />}
              {player.acsl_since  && <Stat label="ACSL Since" value={player.acsl_since} />}
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
      )}

      {/* ── Career Stats Tab ── */}
      {tab === 'stats' && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a] mb-3">
            Career Stats — per Game
          </h2>
          {career.length === 0 ? (
            <div className="bg-[#111] border border-white/5 rounded-xl p-6 text-center text-[#7a7a7a] text-sm">
              No stats recorded yet.
            </div>
          ) : career.map((cs: any) => (
            <div key={cs.id} className="bg-[#111] border border-white/5 rounded-xl p-5 mb-3">
              <h3 className="font-bold mb-3 text-sm">Season {cs.season}</h3>
              <CareerAveragesGrid cs={cs} positions={pos} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
