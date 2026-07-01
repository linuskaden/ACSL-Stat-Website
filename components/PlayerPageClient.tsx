'use client'
import { useState } from 'react'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'

/* ─── Stat helpers (merged columns + all of a player's positions) ─── */
function positionCategories(positions: string[]): string[] {
  const cats: string[] = []
  const add = (c: string) => { if (!cats.includes(c)) cats.push(c) }
  for (const p of positions) {
    if (p === 'QB') { add('pass'); add('rush') }
    else if (p === 'RB') { add('rush'); add('rec') }
    else if (p === 'WR' || p === 'TE') add('rec')
    else if (['DB', 'DL', 'LB'].includes(p)) add('def')
    else if (p === 'K' || p === 'P') add('kick')
  }
  return cats
}
const rushY = (s: any) => (s.rush_yards ?? 0) + (s.qb_rush_yards ?? 0)
const rushT = (s: any) => (s.rush_tds ?? 0) + (s.qb_rush_tds ?? 0)
const recY  = (s: any) => (s.rec_yards ?? 0) + (s.rb_rec_yards ?? 0)
const recN  = (s: any) => (s.receptions ?? 0) + (s.rb_receptions ?? 0)
const recTg = (s: any) => (s.rec_targets ?? 0) + (s.rb_targets ?? 0)

type Item = { label: string; value: string | number }

function buildTotals(positions: string[], s: any): Item[] {
  const items: Item[] = []
  for (const c of positionCategories(positions)) {
    if (c === 'pass') items.push(
      { label: 'Pass YDS', value: s.pass_yards ?? 0 },
      { label: 'Pass TD', value: s.pass_tds ?? 0 },
      { label: 'INT', value: s.interceptions_thrown ?? 0 },
      { label: 'Comp/Att', value: `${s.pass_completions ?? 0}/${s.pass_attempts ?? 0}` },
    )
    else if (c === 'rush') items.push(
      { label: 'Rush YDS', value: rushY(s) },
      { label: 'Rush TD', value: rushT(s) },
      { label: 'Carries', value: s.rush_carries ?? 0 },
    )
    else if (c === 'rec') items.push(
      { label: 'Rec YDS', value: recY(s) },
      { label: 'Rec TD', value: s.rec_tds ?? 0 },
      { label: 'Rec', value: recN(s) },
      { label: 'Targets', value: recTg(s) },
    )
    else if (c === 'def') items.push(
      { label: 'Sacks', value: s.sacks ?? 0 },
      { label: 'Def INT', value: s.def_interceptions ?? 0 },
      { label: 'Tackles', value: s.def_tackles ?? 0 },
    )
    else if (c === 'kick') items.push(
      { label: 'FG', value: `${s.fg_made ?? 0}/${s.fg_attempts ?? 0}` },
      { label: 'EP', value: `${s.ep_made ?? 0}/${s.ep_attempts ?? 0}` },
      { label: 'PTS', value: (s.fg_made ?? 0) * 3 + (s.ep_made ?? 0) },
    )
  }
  return items
}

function buildAverages(positions: string[], s: any, gp: number): Item[] {
  const a = (v: number) => (gp ? (v / gp).toFixed(1) : '—')
  const items: Item[] = []
  for (const c of positionCategories(positions)) {
    if (c === 'pass') items.push({ label: 'Pass YDS/G', value: a(s.pass_yards ?? 0) }, { label: 'Pass TD/G', value: a(s.pass_tds ?? 0) })
    else if (c === 'rush') items.push({ label: 'Rush YDS/G', value: a(rushY(s)) }, { label: 'Rush TD/G', value: a(rushT(s)) })
    else if (c === 'rec') items.push({ label: 'Rec YDS/G', value: a(recY(s)) }, { label: 'Rec/G', value: a(recN(s)) })
    else if (c === 'def') items.push({ label: 'Sacks/G', value: a(s.sacks ?? 0) }, { label: 'INT/G', value: a(s.def_interceptions ?? 0) })
    else if (c === 'kick') items.push({ label: 'FGM/G', value: a(s.fg_made ?? 0) }, { label: 'PTS/G', value: a((s.fg_made ?? 0) * 3 + (s.ep_made ?? 0)) })
  }
  return items
}

const ROUND_LABEL: Record<string, string> = {
  regular_season: 'Regular Season', wildcard: 'Wildcard', semifinal: 'Semifinal',
  third_place: '3rd Place', final: 'ACSL Summer Bowl',
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400 dark:text-[#7a7a7a] uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5 truncate">{value}</div>
    </div>
  )
}

function StatGrid({ items }: { items: Item[] }) {
  if (items.length === 0) return <div className="text-slate-500 dark:text-[#7a7a7a] text-sm italic">Keine Statistiken.</div>
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {items.map(s => (
        <div key={s.label} className="text-center">
          <div className="text-lg font-black text-slate-900 dark:text-white leading-none">{s.value}</div>
          <div className="text-[10px] text-slate-400 dark:text-[#7a7a7a] uppercase tracking-wide mt-1">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

/* ─── Main ─── */
export default function PlayerPageClient({
  player, team, career, gameLog,
}: {
  player: any
  team: any
  career: any[]
  gameLog: any[]
}) {
  const [tab, setTab] = useState<'profile' | 'stats' | 'games'>('profile')
  const pos: string[] = player.positions ?? []
  const accent = team?.primary_color ?? '#ff1d25'

  const TABS: { id: typeof tab; label: string }[] = [
    { id: 'profile', label: 'Profil' },
    { id: 'stats', label: 'Stats' },
    { id: 'games', label: `Spiele${gameLog.length ? ` (${gameLog.length})` : ''}` },
  ]

  return (
    <div>
      {/* Tab nav */}
      <div className="flex gap-1 mb-5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id ? 'text-white' : 'text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/5'
            }`}
            style={tab === t.id ? { background: accent } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Profil ── */}
      {tab === 'profile' && (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl p-6 shadow-sm">
          {team && (
            <div className="flex items-center gap-4 mb-4">
              <TeamBadge team={team} size="lg" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              {player.jersey_number && (
                <span className="text-5xl font-black" style={{ color: accent }}>#{player.jersey_number}</span>
              )}
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{player.first_name} {player.last_name}</h1>
              {player.nickname && <span className="text-slate-400 dark:text-[#7a7a7a]">&quot;{player.nickname}&quot;</span>}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {pos.map((p: string) => (
                <span key={p} className="bg-black/[0.06] dark:bg-white/10 text-slate-900 dark:text-white text-xs px-2 py-0.5 rounded font-semibold">{p}</span>
              ))}
              {team && <Link href={`/teams/${team.slug}`} className="text-slate-500 dark:text-[#7a7a7a] text-sm hover:text-slate-900 dark:hover:text-white">{team.name}</Link>}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {player.height_cm   && <Stat label="Größe"      value={`${player.height_cm} cm`} />}
              {player.weight_kg   && <Stat label="Gewicht"    value={`${player.weight_kg} kg`} />}
              {player.country     && <Stat label="Herkunft"   value={player.country} />}
              {player.hometown    && <Stat label="Heimatort"  value={player.hometown} />}
              {player.field_of_study && <Stat label="Studium"  value={player.field_of_study} />}
              {player.semester    && <Stat label="Semester"   value={player.semester} />}
              {player.acsl_since  && <Stat label="ACSL seit"  value={player.acsl_since} />}
            </div>

            {player.fun_fact && (
              <div className="mt-4 bg-black/[0.04] dark:bg-white/5 rounded-lg px-4 py-2.5 text-sm text-slate-500 dark:text-[#7a7a7a] italic">
                &quot;{player.fun_fact}&quot;
              </div>
            )}
            {player.football_experience && (
              <div className="mt-2 text-xs text-slate-500 dark:text-[#7a7a7a]">
                <span className="text-slate-900 dark:text-white font-medium">Football-Erfahrung: </span>{player.football_experience}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      {tab === 'stats' && (
        career.length === 0 ? (
          <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-6 text-center text-slate-500 dark:text-[#7a7a7a] text-sm shadow-sm">
            Noch keine Statistiken erfasst.
          </div>
        ) : (
          <div className="space-y-3">
            {career.map((cs: any) => {
              const gp = cs.games_played ?? 0
              return (
                <div key={cs.id} className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-5 shadow-sm">
                  <div className="flex items-baseline justify-between mb-4">
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">Saison {cs.season}</h3>
                    <span className="text-xs text-slate-400 dark:text-[#7a7a7a]">{gp} Spiele</span>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#7a7a7a] mb-2">Total</div>
                  <StatGrid items={buildTotals(pos, cs)} />
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-[#7a7a7a] mt-5 mb-2">Pro Spiel</div>
                  <StatGrid items={buildAverages(pos, cs, gp)} />
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ── Spiele (Game-Log) ── */}
      {tab === 'games' && (
        gameLog.length === 0 ? (
          <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-6 text-center text-slate-500 dark:text-[#7a7a7a] text-sm shadow-sm">
            Noch keine Spiele mit erfassten Stats.
          </div>
        ) : (
          <div className="space-y-2">
            {gameLog.map((g: any) => {
              const items = buildTotals(pos, g.stats)
              const resultColor = g.result === 'W' ? '#04a550' : g.result === 'L' ? '#ff1d25' : 'var(--fg-muted)'
              const dateStr = g.date ? new Date(g.date).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''
              return (
                <Link key={g.gameId} href={`/games/${g.gameId}`} className="block">
                  <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-4 shadow-sm hover:border-black/20 dark:hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* result + opponent */}
                      <div className="flex items-center gap-2 min-w-[190px]">
                        {g.result && (
                          <span className="text-xs font-black w-5 text-center" style={{ color: resultColor }}>{g.result}</span>
                        )}
                        <span className="text-[11px] text-slate-400 dark:text-[#7a7a7a]">{g.isHome ? 'vs' : '@'}</span>
                        {g.opponent?.logo_url && <img src={g.opponent.logo_url} alt="" className="w-6 h-6 object-contain" />}
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{g.opponent?.short_name ?? 'TBD'}</span>
                        {g.teamScore != null && g.oppScore != null && (
                          <span className="text-xs font-semibold text-slate-500 dark:text-[#7a7a7a] tabular-nums">{g.teamScore}–{g.oppScore}</span>
                        )}
                      </div>
                      {/* meta */}
                      <div className="text-[10px] text-slate-400 dark:text-[#7a7a7a] uppercase tracking-wide">
                        {ROUND_LABEL[g.gameType] ?? g.gameType}{dateStr && ` · ${dateStr}`}
                      </div>
                      {/* stat line */}
                      <div className="flex items-center gap-4 ml-auto flex-wrap">
                        {items.map(it => (
                          <div key={it.label} className="text-center">
                            <div className="text-sm font-black text-slate-900 dark:text-white leading-none">{it.value}</div>
                            <div className="text-[9px] text-slate-400 dark:text-[#7a7a7a] uppercase tracking-wide mt-0.5">{it.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
