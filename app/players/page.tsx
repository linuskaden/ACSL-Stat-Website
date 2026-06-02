'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'
import type { PlayerWithTeam, Team } from '@/lib/supabase/types'

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P']

type SortKey = 'num' | 'name' | 'pos' | 'team' | 'study' | 'ht' | 'wt' | 'from'

function sortValue(p: PlayerWithTeam, key: SortKey): string | number | null {
  switch (key) {
    case 'num':   return p.jersey_number ?? null
    case 'name':  return `${p.last_name ?? ''} ${p.first_name ?? ''}`.trim().toLowerCase()
    case 'pos':   return (p.positions?.[0] ?? '').toLowerCase()
    case 'team':  return (p.team?.short_name ?? '').toLowerCase()
    case 'study': return (p.field_of_study ?? '').toLowerCase()
    case 'ht':    return p.height_cm ?? null
    case 'wt':    return p.weight_kg ?? null
    case 'from':  return (p.hometown ?? '').toLowerCase()
  }
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithTeam[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [search, setSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('all')
  const [selectedPos, setSelectedPos] = useState('All')
  const [selectedCountry, setSelectedCountry] = useState('all')
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('players').select('*, team:teams(*)').eq('is_active', true).order('last_name'),
    ]).then(([{ data: t }, { data: p }]) => {
      setTeams(t ?? [])
      setPlayers((p ?? []) as PlayerWithTeam[])
      setLoading(false)
    })
  }, [])

  const countries = [...new Set(players.map(p => p.country).filter(Boolean) as string[])].sort()

  const filtered = players.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || [
      p.first_name, p.last_name, p.nickname,
      String(p.jersey_number ?? ''), p.field_of_study,
      ...(p.positions ?? []), p.hometown, p.country,
    ].some(v => v?.toLowerCase().includes(q))
    const matchTeam = selectedTeam === 'all' || p.team_id === selectedTeam
    const matchPos = selectedPos === 'All' || p.positions.includes(selectedPos)
    const matchCountry = selectedCountry === 'all' || p.country === selectedCountry
    return matchSearch && matchTeam && matchPos && matchCountry
  })

  const sorted = [...filtered].sort((a, b) => {
    const av = sortValue(a, sortKey)
    const bv = sortValue(b, sortKey)
    const aMissing = av === null || av === ''
    const bMissing = bv === null || bv === ''
    if (aMissing && bMissing) return 0
    if (aMissing) return 1   // missing values always sort last
    if (bMissing) return -1
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="text-3xl font-black italic tracking-tight text-slate-900 dark:text-white">Players</h1>
        <span className="text-slate-500 dark:text-[#7a7a7a] text-sm">{filtered.length} results</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, #, position, study..."
          className="bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#7a7a7a] focus:outline-none focus:border-[#ff1d25] w-64"
        />
        <select
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
          className="bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#ff1d25]"
        >
          <option value="all">All Teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select
          value={selectedCountry}
          onChange={e => setSelectedCountry(e.target.value)}
          className="bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-[#ff1d25]"
        >
          <option value="all">All Countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-1">
          {POSITIONS.map(pos => (
            <button key={pos} onClick={() => setSelectedPos(pos)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                selectedPos === pos ? 'bg-[#ff1d25] text-white' : 'bg-white dark:bg-[#111] text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white border border-black/[0.07] dark:border-white/5'
              }`}>
              {pos}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500 dark:text-[#7a7a7a] text-sm py-8 text-center">Loading...</div>
      ) : (
        <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.07] dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                <SortHeader label="#"      sk="num"   active={sortKey} dir={sortDir} onSort={toggleSort} className="text-left px-4" />
                <SortHeader label="Player" sk="name"  active={sortKey} dir={sortDir} onSort={toggleSort} className="text-left px-4" />
                <SortHeader label="Pos"    sk="pos"   active={sortKey} dir={sortDir} onSort={toggleSort} className="text-left px-4" />
                <SortHeader label="Team"   sk="team"  active={sortKey} dir={sortDir} onSort={toggleSort} className="text-left px-4 hidden md:table-cell" />
                <SortHeader label="Study"  sk="study" active={sortKey} dir={sortDir} onSort={toggleSort} className="text-left px-4 hidden lg:table-cell" />
                <SortHeader label="Ht"     sk="ht"    active={sortKey} dir={sortDir} onSort={toggleSort} className="text-center px-3 hidden md:table-cell" center />
                <SortHeader label="Wt"     sk="wt"    active={sortKey} dir={sortDir} onSort={toggleSort} className="text-center px-3 hidden md:table-cell" center />
                <SortHeader label="From"   sk="from"  active={sortKey} dir={sortDir} onSort={toggleSort} className="text-left px-4 hidden md:table-cell" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 dark:text-[#7a7a7a] text-sm">No players found.</td></tr>
              ) : sorted.map(p => (
                <tr key={p.id} className="border-b border-black/[0.05] dark:border-white/5 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-slate-500 dark:text-[#7a7a7a]">{p.jersey_number ?? '—'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/players/${p.id}`} className="hover:text-[#ff1d25] transition-colors">
                      <span className="font-semibold text-slate-900 dark:text-white">{p.first_name} {p.last_name}</span>
                    </Link>
                    {p.nickname && <span className="text-slate-400 dark:text-[#7a7a7a] text-xs ml-1">"{p.nickname}"</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-[#7a7a7a]">{p.positions.join('/')}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    {p.team && <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: p.team.primary_color }} />
                      <span className="text-xs text-slate-500 dark:text-[#7a7a7a]">{p.team.short_name}</span>
                    </div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-[#7a7a7a] hidden lg:table-cell max-w-[180px] truncate">
                    {p.field_of_study ?? '—'}
                  </td>
                  <td className="text-center px-3 py-2.5 text-xs text-slate-500 dark:text-[#7a7a7a] hidden md:table-cell">
                    {p.height_cm ?? '—'}
                  </td>
                  <td className="text-center px-3 py-2.5 text-xs text-slate-500 dark:text-[#7a7a7a] hidden md:table-cell">
                    {p.weight_kg ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-[#7a7a7a] hidden md:table-cell">
                    {p.hometown ? `${p.hometown}${p.country ? `, ${p.country}` : ''}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SortHeader({ label, sk, active, dir, onSort, className, center }: {
  label: string
  sk: SortKey
  active: SortKey
  dir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
  className?: string
  center?: boolean
}) {
  const isActive = active === sk
  return (
    <th className={`py-2.5 text-slate-400 dark:text-[#7a7a7a] font-semibold text-xs ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onSort(sk)}
        className={`inline-flex items-center gap-1 select-none hover:text-slate-900 dark:hover:text-white transition-colors ${center ? 'justify-center' : ''} ${isActive ? 'text-slate-900 dark:text-white' : ''}`}
      >
        {label}
        <span className={`text-[9px] leading-none ${isActive ? 'text-[#ff1d25]' : 'opacity-0'}`}>
          {isActive && dir === 'desc' ? '▼' : '▲'}
        </span>
      </button>
    </th>
  )
}
