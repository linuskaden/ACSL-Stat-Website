'use client'
import { useState } from 'react'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'
import type { StandingsWithTeam } from '@/lib/supabase/types'
import type { FormResult } from '@/lib/records'

type SortKey = 'rank' | 'team' | 'record' | 'pf' | 'pa' | 'diff'

function value(s: StandingsWithTeam, key: SortKey): number | string {
  switch (key) {
    case 'rank':   return s.playoff_seed ?? 999
    case 'team':   return (s.team?.short_name ?? '').toLowerCase()
    case 'record': return s.wins ?? 0
    case 'pf':     return s.points_for ?? 0
    case 'pa':     return s.points_against ?? 0
    case 'diff':   return (s.points_for ?? 0) - (s.points_against ?? 0)
  }
}

export default function StandingsTable({ standings, formByTeam = {} }: {
  standings: StandingsWithTeam[]
  formByTeam?: Record<string, FormResult[]>
}) {
  // Default view: official standing order (seed asc; fall back to wins desc).
  const [sortKey, setSortKey] = useState<SortKey>('rank')
  // 'rank' and 'team' read best ascending; stats read best descending.
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'rank' || key === 'team' ? 'asc' : 'desc')
    }
  }

  const sorted = [...standings].sort((a, b) => {
    const av = value(a, sortKey)
    const bv = value(b, sortKey)
    let cmp: number
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
    else cmp = String(av).localeCompare(String(bv))
    if (cmp === 0) {
      // Stable tiebreak: official seed, then wins.
      cmp = (a.playoff_seed ?? 999) - (b.playoff_seed ?? 999) || (b.wins ?? 0) - (a.wins ?? 0)
      return cmp
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (standings.length === 0) {
    return (
      <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-8 text-center text-slate-400 dark:text-[#7a7a7a] text-sm">Season not started yet</div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr className="border-b border-black/[0.07] dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
              <SortTh label="#"      sk="rank"   active={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
              <SortTh label="Team"   sk="team"   active={sortKey} dir={sortDir} onSort={toggleSort} align="left" />
              <SortTh label="Record" sk="record" active={sortKey} dir={sortDir} onSort={toggleSort} />
              <th className="text-center px-3 py-3.5 text-slate-400 dark:text-[#7a7a7a] font-semibold text-xs uppercase tracking-wider">Form</th>
              <SortTh label="PF"     sk="pf"     active={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortTh label="PA"     sk="pa"     active={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortTh label="Diff"   sk="diff"   active={sortKey} dir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map(s => {
              const diff = (s.points_for ?? 0) - (s.points_against ?? 0)
              const form = s.team ? (formByTeam[s.team.id] ?? []) : []
              return (
                <tr key={s.id} className="border-b border-black/[0.05] dark:border-white/5 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] group">
                  <td className="px-4 py-4 text-slate-400 dark:text-[#7a7a7a] text-sm tabular-nums">{s.playoff_seed ?? '—'}</td>
                  <td className="px-4 py-4">
                    <Link href={`/teams/${s.team?.slug ?? ''}`} className="flex items-center gap-3">
                      <TeamBadge team={s.team} size="md" />
                      <span className="font-bold text-slate-900 dark:text-white group-hover:text-[#ff1d25] transition-colors">{s.team?.short_name}</span>
                    </Link>
                  </td>
                  <td className="text-center px-3 py-4 font-bold text-slate-900 dark:text-white tabular-nums">{s.wins ?? 0}-{s.losses ?? 0}</td>
                  <td className="px-3 py-4">
                    <div className="flex items-center justify-center gap-1">
                      {form.length === 0
                        ? <span className="text-slate-300 dark:text-[#555] text-sm">—</span>
                        : form.map((r, i) => <FormBadge key={i} result={r} />)}
                    </div>
                  </td>
                  <td className="text-center px-3 py-4 text-slate-500 dark:text-[#7a7a7a] tabular-nums">{s.points_for}</td>
                  <td className="text-center px-3 py-4 text-slate-500 dark:text-[#7a7a7a] tabular-nums">{s.points_against}</td>
                  <td className={`text-center px-3 py-4 font-semibold tabular-nums ${diff > 0 ? 'text-[#04a550]' : diff < 0 ? 'text-[#ff1d25]' : 'text-slate-500 dark:text-[#7a7a7a]'}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FormBadge({ result }: { result: FormResult }) {
  const style =
    result === 'W' ? 'bg-[#04a550] text-white'
    : result === 'L' ? 'bg-[#ff1d25] text-white'
    : 'bg-black/[0.12] dark:bg-white/[0.15] text-slate-600 dark:text-[#bbb]'
  return (
    <span className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-black ${style}`} title={result === 'W' ? 'Win' : result === 'L' ? 'Loss' : 'Tie'}>
      {result}
    </span>
  )
}

function SortTh({ label, sk, active, dir, onSort, align = 'center' }: {
  label: string
  sk: SortKey
  active: SortKey
  dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
  align?: 'left' | 'center'
}) {
  const isActive = active === sk
  return (
    <th className={`${align === 'left' ? 'text-left px-4' : 'text-center px-3'} py-3.5 text-slate-400 dark:text-[#7a7a7a] font-semibold text-xs uppercase tracking-wider`}>
      <button
        type="button"
        onClick={() => onSort(sk)}
        className={`inline-flex items-center gap-1 select-none hover:text-slate-900 dark:hover:text-white transition-colors ${align === 'center' ? 'justify-center' : ''} ${isActive ? 'text-slate-900 dark:text-white' : ''}`}
      >
        {label}
        <span className={`text-[9px] leading-none ${isActive ? 'text-[#ff1d25]' : 'opacity-0'}`}>
          {isActive && dir === 'desc' ? '▼' : '▲'}
        </span>
      </button>
    </th>
  )
}
