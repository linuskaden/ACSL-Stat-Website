'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'

// ── Unified leaderboard entry (player OR team) ───────────────────────────────
export type LeaderEntry = {
  id: string
  name: string
  subtitle: string
  href: string
  color: string
  logo: string | null
  jersey: number | null
  positions: string[]
  teamId: string | null
  teamShort: string | null
  games_played: number
  s: Record<string, number | null>
}

type Cat = {
  key: string
  label: string
  abbr: string
  group: string
  pct?: boolean
  decimals?: number
  noPerGame?: boolean
  minKey?: string
  minVal?: number
}

const CATS: Cat[] = [
  { key: 'pass_yards',          label: 'Passing Yards',   abbr: 'Pass Yds', group: 'Passing' },
  { key: 'pass_tds',            label: 'Passing TDs',     abbr: 'Pass TDs', group: 'Passing' },
  { key: 'comp_pct',            label: 'Completion %',    abbr: 'Comp %',   group: 'Passing', pct: true, noPerGame: true, minKey: 'pass_attempts', minVal: 5 },
  { key: 'interceptions_thrown',label: 'INTs Thrown',     abbr: 'INT',      group: 'Passing' },
  { key: 'total_rush_yards',    label: 'Rushing Yards',   abbr: 'Rush Yds', group: 'Rushing' },
  { key: 'total_rush_tds',      label: 'Rushing TDs',     abbr: 'Rush TDs', group: 'Rushing' },
  { key: 'total_rec_yards',     label: 'Receiving Yards', abbr: 'Rec Yds',  group: 'Receiving' },
  { key: 'total_receptions',    label: 'Receptions',      abbr: 'Rec',      group: 'Receiving' },
  { key: 'rec_tds',             label: 'Receiving TDs',   abbr: 'Rec TDs',  group: 'Receiving' },
  { key: 'total_tds',           label: 'Total TDs',       abbr: 'TDs',      group: 'Scoring' },
  { key: 'points',              label: 'Points',          abbr: 'PTS',      group: 'Scoring' },
  { key: 'sacks',               label: 'Sacks',           abbr: 'Sacks',    group: 'Defense', decimals: 1 },
  { key: 'def_interceptions',   label: 'Interceptions',   abbr: 'Def INT',  group: 'Defense' },
  { key: 'fg_made',             label: 'Field Goals',     abbr: 'FG',       group: 'Kicking' },
  { key: 'ep_made',             label: 'Extra Points',    abbr: 'XP',       group: 'Kicking' },
  { key: 'fg_pct',              label: 'FG %',            abbr: 'FG %',     group: 'Kicking', pct: true, noPerGame: true, minKey: 'fg_attempts', minVal: 1 },
]

const GROUPS = ['Passing', 'Rushing', 'Receiving', 'Scoring', 'Defense', 'Kicking']
const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P']

function fmt(v: number, cat: Cat): string {
  if (cat.pct) return `${v.toFixed(1)}%`
  if (cat.decimals) return v.toFixed(cat.decimals)
  return String(Math.round(v))
}

function perGame(e: LeaderEntry, cat: Cat, teamsMode: boolean): string {
  if (cat.noPerGame || teamsMode || e.games_played <= 0) return ''
  const v = (e.s[cat.key] ?? 0) / e.games_played
  return `${v.toFixed(1)}/G`
}

function rank(entries: LeaderEntry[], cat: Cat, limit: number): LeaderEntry[] {
  return entries
    .filter(e => {
      const v = e.s[cat.key]
      if (v == null || v <= 0) return false
      if (cat.minKey && (e.s[cat.minKey] ?? 0) < (cat.minVal ?? 0)) return false
      return true
    })
    .sort((a, b) => (b.s[cat.key] ?? 0) - (a.s[cat.key] ?? 0))
    .slice(0, limit)
}

// ── Row ──────────────────────────────────────────────────────────────────────
function EntryRow({ e, i, cat, teamsMode, big }: { e: LeaderEntry; i: number; cat: Cat; teamsMode: boolean; big?: boolean }) {
  const pg = perGame(e, cat, teamsMode)
  return (
    <Link href={e.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors group">
      <span className={`w-5 text-center text-xs font-black tabular-nums shrink-0 ${i === 0 ? 'text-[#ff1d25]' : 'text-slate-300 dark:text-[#555]'}`}>{i + 1}</span>
      {e.logo
        ? <img src={e.logo} alt="" className={`${big ? 'w-8 h-8' : 'w-6 h-6'} object-contain shrink-0`} />
        : <span className={`${big ? 'w-8 h-8' : 'w-6 h-6'} rounded shrink-0`} style={{ background: e.color }} />}
      <div className="flex-1 min-w-0">
        <span className={`font-semibold text-slate-900 dark:text-white group-hover:text-[#ff1d25] transition-colors truncate block ${big ? 'text-base' : 'text-sm'}`}>
          {e.jersey != null && <span className="text-slate-400 dark:text-[#666]">#{e.jersey} </span>}{e.name}
        </span>
        {e.subtitle && <span className="text-[11px] text-slate-400 dark:text-[#666] truncate block">{e.subtitle}</span>}
      </div>
      <div className="text-right shrink-0">
        <span className={`font-black tabular-nums text-slate-900 dark:text-white ${big ? 'text-xl' : 'text-sm'}`}>{fmt(e.s[cat.key] ?? 0, cat)}</span>
        {pg && <span className="text-[10px] text-slate-400 dark:text-[#666] block">{pg}</span>}
      </div>
    </Link>
  )
}

// ── Category card (grid) ─────────────────────────────────────────────────────
function CatCard({ cat, entries, teamsMode, onOpen }: { cat: Cat; entries: LeaderEntry[]; teamsMode: boolean; onOpen: () => void }) {
  const top = rank(entries, cat, 5)
  return (
    <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl overflow-hidden shadow-sm flex flex-col">
      <div className="px-4 py-3 border-b border-black/[0.06] dark:border-white/5 flex items-center justify-between">
        <span className="text-sm font-black text-slate-900 dark:text-white">{cat.label}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#666]">{cat.abbr}</span>
      </div>
      {top.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-[#555] flex-1">Noch keine Daten</div>
      ) : (
        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05] flex-1">
          {top.map((e, i) => <EntryRow key={e.id} e={e} i={i} cat={cat} teamsMode={teamsMode} />)}
        </div>
      )}
      <button onClick={onOpen} className="px-4 py-2.5 border-t border-black/[0.06] dark:border-white/5 text-xs font-bold text-[#ff1d25] hover:bg-[#ff1d25]/[0.06] transition-colors text-left">
        Ganze Rangliste →
      </button>
    </div>
  )
}

// ── Detail view (full ranking) ───────────────────────────────────────────────
function Detail({ cat, entries, teamsMode, onBack }: { cat: Cat; entries: LeaderEntry[]; teamsMode: boolean; onBack: () => void }) {
  const ranked = rank(entries, cat, 50)
  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-[#7a7a7a] hover:text-[#ff1d25] transition-colors mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        Alle Kategorien
      </button>
      <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{cat.label}</h2>
      <p className="text-sm text-slate-400 dark:text-[#7a7a7a] mb-5">{teamsMode ? 'Teams' : 'Spieler'} · Top {ranked.length}</p>

      {ranked.length === 0 ? (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl p-10 text-center text-slate-400 dark:text-[#555] text-sm">Noch keine Daten.</div>
      ) : (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl overflow-hidden shadow-sm max-w-2xl">
          <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
            {ranked.map((e, i) => <EntryRow key={e.id} e={e} i={i} cat={cat} teamsMode={teamsMode} big={i === 0} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function LeadersClient({
  playersRegular, playersPlayoff, teamsRegular, teamsPlayoff,
}: {
  playersRegular: LeaderEntry[]
  playersPlayoff: LeaderEntry[]
  teamsRegular: LeaderEntry[]
  teamsPlayoff: LeaderEntry[]
}) {
  const [mode, setMode] = useState<'players' | 'teams'>('players')
  const [phase, setPhase] = useState<'regular' | 'playoff'>('regular')
  const [teamFilter, setTeamFilter] = useState('all')
  const [posFilter, setPosFilter] = useState('All')
  const [detailKey, setDetailKey] = useState<string | null>(null)

  const teamsMode = mode === 'teams'

  const base = teamsMode
    ? (phase === 'regular' ? teamsRegular : teamsPlayoff)
    : (phase === 'regular' ? playersRegular : playersPlayoff)

  // Team options for the players filter
  const teamOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of playersRegular.concat(playersPlayoff)) {
      if (e.teamId && e.teamShort) m.set(e.teamId, e.teamShort)
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [playersRegular, playersPlayoff])

  const entries = useMemo(() => {
    if (teamsMode) return base
    return base.filter(e => {
      if (teamFilter !== 'all' && e.teamId !== teamFilter) return false
      if (posFilter !== 'All' && !e.positions.includes(posFilter)) return false
      return true
    })
  }, [base, teamsMode, teamFilter, posFilter])

  const noPlayoffData = phase === 'playoff' && base.length === 0
  const detailCat = detailKey ? CATS.find(c => c.key === detailKey) ?? null : null

  const pill = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-bold transition-all ${active ? 'bg-white dark:bg-[#222] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white'}`
  const selectCls = 'bg-white dark:bg-[#111] border border-black/[0.1] dark:border-white/10 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-[#ff1d25]'

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="flex gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.05] rounded-xl">
          <button onClick={() => { setMode('players'); setDetailKey(null) }} className={pill(mode === 'players')}>Spieler</button>
          <button onClick={() => { setMode('teams'); setDetailKey(null) }} className={pill(teamsMode)}>Teams</button>
        </div>
        <div className="flex gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.05] rounded-xl">
          <button onClick={() => setPhase('regular')} className={pill(phase === 'regular')}>Regular Season</button>
          <button onClick={() => setPhase('playoff')} className={pill(phase === 'playoff')}>Playoffs</button>
        </div>

        {!teamsMode && (
          <div className="flex gap-2 ml-auto">
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className={selectCls}>
              <option value="all">Alle Teams</option>
              {teamOptions.map(([id, short]) => <option key={id} value={id}>{short}</option>)}
            </select>
            <select value={posFilter} onChange={e => setPosFilter(e.target.value)} className={selectCls}>
              {POSITIONS.map(p => <option key={p} value={p}>{p === 'All' ? 'Alle Positionen' : p}</option>)}
            </select>
          </div>
        )}
      </div>

      {noPlayoffData ? (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl p-10 text-center text-slate-400 dark:text-[#555] text-sm shadow-sm">
          Noch keine Playoff-Spiele gespielt.
        </div>
      ) : detailCat ? (
        <Detail cat={detailCat} entries={entries} teamsMode={teamsMode} onBack={() => setDetailKey(null)} />
      ) : (
        GROUPS.map(group => {
          const cats = CATS.filter(c => c.group === group)
          return (
            <div key={group} className="mb-10">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-[#7a7a7a] mb-4">{group}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cats.map(cat => (
                  <CatCard key={cat.key} cat={cat} entries={entries} teamsMode={teamsMode} onOpen={() => setDetailKey(cat.key)} />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
