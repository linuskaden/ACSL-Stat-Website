'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import TeamBadge from '@/components/TeamBadge'
import type { PlayerWithTeam, Team } from '@/lib/supabase/types'

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P']

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerWithTeam[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [search, setSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('all')
  const [selectedPos, setSelectedPos] = useState('All')
  const [loading, setLoading] = useState(true)

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

  const filtered = players.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || [
      p.first_name, p.last_name, p.nickname,
      String(p.jersey_number ?? ''), p.field_of_study,
      ...(p.positions ?? []), p.hometown, p.country,
    ].some(v => v?.toLowerCase().includes(q))
    const matchTeam = selectedTeam === 'all' || p.team_id === selectedTeam
    const matchPos = selectedPos === 'All' || p.positions.includes(selectedPos)
    return matchSearch && matchTeam && matchPos
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <h1 className="text-2xl font-black">Players</h1>
        <span className="text-[#7a7a7a] text-sm">{filtered.length} results</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, #, position, study..."
          className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-[#7a7a7a] focus:outline-none focus:border-[#ff1d25] w-64"
        />
        <select
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
          className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff1d25]"
        >
          <option value="all">All Teams</option>
          {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex gap-1">
          {POSITIONS.map(pos => (
            <button key={pos} onClick={() => setSelectedPos(pos)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                selectedPos === pos ? 'bg-[#ff1d25] text-white' : 'bg-[#111] text-[#7a7a7a] hover:text-white border border-white/5'
              }`}>
              {pos}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-[#7a7a7a] text-sm py-8 text-center">Loading...</div>
      ) : (
        <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-2.5 text-[#7a7a7a] font-medium text-xs">#</th>
                <th className="text-left px-4 py-2.5 text-[#7a7a7a] font-medium text-xs">Player</th>
                <th className="text-left px-4 py-2.5 text-[#7a7a7a] font-medium text-xs">Pos</th>
                <th className="text-left px-4 py-2.5 text-[#7a7a7a] font-medium text-xs hidden md:table-cell">Team</th>
                <th className="text-left px-4 py-2.5 text-[#7a7a7a] font-medium text-xs hidden lg:table-cell">Study</th>
                <th className="text-center px-3 py-2.5 text-[#7a7a7a] font-medium text-xs hidden md:table-cell">Ht</th>
                <th className="text-center px-3 py-2.5 text-[#7a7a7a] font-medium text-xs hidden md:table-cell">Wt</th>
                <th className="text-left px-4 py-2.5 text-[#7a7a7a] font-medium text-xs hidden xl:table-cell">From</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-[#7a7a7a] text-sm">No players found.</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-[#7a7a7a]">{p.jersey_number ?? '—'}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/players/${p.id}`} className="hover:text-[#ff1d25] transition-colors">
                      <span className="font-semibold">{p.first_name} {p.last_name}</span>
                    </Link>
                    {p.nickname && <span className="text-[#7a7a7a] text-xs ml-1">"{p.nickname}"</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#7a7a7a]">{p.positions.join('/')}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    {p.team && <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: p.team.primary_color }} />
                      <span className="text-xs text-[#7a7a7a]">{p.team.short_name}</span>
                    </div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#7a7a7a] hidden lg:table-cell max-w-[180px] truncate">
                    {p.field_of_study ?? '—'}
                  </td>
                  <td className="text-center px-3 py-2.5 text-xs text-[#7a7a7a] hidden md:table-cell">
                    {p.height_cm ?? '—'}
                  </td>
                  <td className="text-center px-3 py-2.5 text-xs text-[#7a7a7a] hidden md:table-cell">
                    {p.weight_kg ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#7a7a7a] hidden xl:table-cell">
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
