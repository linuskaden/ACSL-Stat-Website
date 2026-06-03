'use client'
import { useState } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────
export type StatRow = {
  player: {
    id: string
    first_name: string
    last_name: string
    jersey_number: number | null
    positions: string[]
    team: { id: string; name: string; short_name: string; slug: string; primary_color: string } | null
  }
  games_played: number
  // raw
  pass_yards: number;        pass_tds: number;    pass_completions: number
  pass_attempts: number;     interceptions_thrown: number
  qb_rush_yards: number;     qb_rush_tds: number
  rush_yards: number;        rush_tds: number
  rb_rec_yards: number;      rb_receptions: number
  rec_yards: number;         rec_tds: number;     receptions: number
  sacks: number;             def_interceptions: number
  fg_made: number;           fg_attempts: number
  ep_made: number;           ep_attempts: number
  // computed
  total_rush_yards: number;  total_rush_tds: number
  total_rec_yards: number;   total_receptions: number
  comp_pct: number | null
}

// ── Category definitions ─────────────────────────────────────────────────────
type Category = {
  key: keyof StatRow
  label: string
  abbr: string
  group: 'Passing' | 'Rushing' | 'Receiving' | 'Defense'
  format?: (v: number) => string
  perGameFmt?: (v: number) => string
  noPerGame?: boolean
  minAttempts?: boolean     // only show players with >= 5 pass attempts (comp%)
}

const CATEGORIES: Category[] = [
  // Passing
  { key: 'pass_yards',          label: 'Passing Yards',    abbr: 'PASS YDS',  group: 'Passing' },
  { key: 'pass_tds',            label: 'Passing TDs',      abbr: 'PASS TDs',  group: 'Passing' },
  { key: 'comp_pct',            label: 'Completion %',     abbr: 'COMP %',    group: 'Passing', format: v => `${v.toFixed(1)}%`, noPerGame: true, minAttempts: true },
  { key: 'interceptions_thrown',label: 'INTs Thrown',      abbr: 'INT',       group: 'Passing' },
  // Rushing
  { key: 'total_rush_yards',    label: 'Rushing Yards',    abbr: 'RUSH YDS',  group: 'Rushing' },
  { key: 'total_rush_tds',      label: 'Rushing TDs',      abbr: 'RUSH TDs',  group: 'Rushing' },
  // Receiving
  { key: 'total_rec_yards',     label: 'Receiving Yards',  abbr: 'REC YDS',   group: 'Receiving' },
  { key: 'rec_tds',             label: 'Receiving TDs',    abbr: 'REC TDs',   group: 'Receiving' },
  { key: 'total_receptions',    label: 'Receptions',       abbr: 'REC',       group: 'Receiving' },
  // Defense
  { key: 'sacks',               label: 'Sacks',            abbr: 'SACKS',     group: 'Defense', format: v => v.toFixed(1) },
  { key: 'def_interceptions',   label: 'Def. Interceptions', abbr: 'DEF INT', group: 'Defense' },
]

const GROUPS: Array<{ label: string; id: Category['group'] }> = [
  { label: 'Passing',   id: 'Passing' },
  { label: 'Rushing',   id: 'Rushing' },
  { label: 'Receiving', id: 'Receiving' },
  { label: 'Defense',   id: 'Defense' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function getVal(row: StatRow, key: keyof StatRow): number {
  const v = row[key]
  return typeof v === 'number' ? v : 0
}

function top5(rows: StatRow[], cat: Category): StatRow[] {
  let filtered = rows
  if (cat.minAttempts) filtered = rows.filter(r => r.pass_attempts >= 5)
  return [...filtered]
    .filter(r => {
      const v = getVal(r, cat.key)
      return v > 0
    })
    .sort((a, b) => getVal(b, cat.key) - getVal(a, cat.key))
    .slice(0, 5)
}

function fmtStat(v: number, cat: Category): string {
  return cat.format ? cat.format(v) : String(v)
}

function fmtPerGame(total: number, gamesPlayed: number, cat: Category): string {
  if (cat.noPerGame || gamesPlayed === 0) return ''
  const avg = total / gamesPlayed
  return cat.perGameFmt ? cat.perGameFmt(avg) : avg.toFixed(1)
}

// ── Leader Card ───────────────────────────────────────────────────────────────
function LeaderCard({ cat, rows }: { cat: Category; rows: StatRow[] }) {
  const leaders = top5(rows, cat)

  return (
    <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a]">{cat.abbr}</span>
        <span className="text-[11px] text-slate-400 dark:text-[#555]">{cat.label}</span>
      </div>

      {leaders.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-[#555]">No data yet</div>
      ) : (
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
          {leaders.map((row, i) => {
            const val   = getVal(row, cat.key)
            const pg    = fmtPerGame(val, row.games_played, cat)
            const color = row.player.team?.primary_color ?? '#ccc'
            const isFirst = i === 0

            return (
              <Link
                key={row.player.id}
                href={`/players/${row.player.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group"
              >
                {/* Rank */}
                <span className={`w-5 text-center text-xs font-bold tabular-nums shrink-0 ${
                  isFirst ? 'text-[#ff1d25]' : 'text-slate-300 dark:text-[#444]'
                }`}>{i + 1}</span>

                {/* Team color dot */}
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-[#ff1d25] transition-colors truncate block">
                    {row.player.first_name} {row.player.last_name}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-[#555] truncate block">
                    {row.player.team?.short_name ?? '—'} · {row.player.positions.join('/')}
                  </span>
                </div>

                {/* Stat */}
                <div className="text-right shrink-0">
                  <span className={`font-black tabular-nums ${
                    isFirst ? 'text-slate-900 dark:text-white text-base' : 'text-slate-700 dark:text-[#ccc] text-sm'
                  }`}>
                    {fmtStat(val, cat)}
                  </span>
                  {pg && (
                    <span className="text-[10px] text-slate-400 dark:text-[#555] block">
                      {pg}/G
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Client Component ─────────────────────────────────────────────────────
export default function LeadersClient({
  regularStats,
  playoffStats,
}: {
  regularStats: StatRow[]
  playoffStats: StatRow[]
}) {
  const [tab, setTab] = useState<'regular' | 'playoff'>('regular')
  const rows = tab === 'regular' ? regularStats : playoffStats

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.04] rounded-xl w-fit mb-8">
        {([
          { id: 'regular', label: 'Regular Season' },
          { id: 'playoff', label: 'Playoffs' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-white dark:bg-[#222] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-[#7a7a7a] hover:text-slate-700 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Playoff empty state */}
      {tab === 'playoff' && playoffStats.length === 0 && (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-10 text-center shadow-sm">
          <p className="text-slate-400 dark:text-[#555] text-sm">No playoff games played yet.</p>
        </div>
      )}

      {/* Category groups */}
      {(tab === 'regular' || playoffStats.length > 0) && GROUPS.map(group => {
        const cats = CATEGORIES.filter(c => c.group === group.id)
        return (
          <div key={group.id} className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-4">
              {group.label}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cats.map(cat => (
                <LeaderCard key={cat.key as string} cat={cat} rows={rows} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
