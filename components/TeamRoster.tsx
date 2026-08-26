'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'

type Player = {
  id: string; first_name: string; last_name: string; nickname: string | null
  jersey_number: number | string | null; positions: string[]
  field_of_study: string | null; height_cm: number | null; weight_kg: number | null
}

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P']

export default function TeamRoster({ players, primary }: { players: Player[]; primary: string }) {
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return players.filter(p => {
      const matchPos = filter === 'All' || p.positions?.includes(filter)
      const matchSearch = !q || [
        p.first_name, p.last_name, String(p.jersey_number ?? ''),
        ...(p.positions ?? []), p.nickname ?? '', p.field_of_study ?? '',
      ].some(v => v.toLowerCase().includes(q))
      return matchPos && matchSearch
    })
  }, [players, filter, search])

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Spieler oder Nummer suchen…"
          className="flex-1 min-w-[200px] max-w-md bg-white dark:bg-[#111] border border-black/[0.08] dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-[color:var(--pc)]"
          style={{ ['--pc' as any]: primary }}
        />
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map(pos => {
            const active = filter === pos
            return (
              <button
                key={pos}
                onClick={() => setFilter(pos)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors"
                style={{
                  background: active ? primary : 'var(--subtle)',
                  color: active ? '#fff' : 'var(--fg-muted)',
                }}
              >
                {pos}
              </button>
            )
          })}
        </div>
      </div>

      <div className="text-xs text-slate-400 dark:text-[#7a7a7a] mb-3">{filtered.length} Spieler</div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-[#555] text-sm">Keine Spieler gefunden</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(p => (
            <Link
              key={p.id}
              href={`/players/${p.id}`}
              className="group relative bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden"
            >
              {/* accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1" style={{ background: primary }} />

              <div className="flex items-start justify-between mb-6 mt-1">
                <span className="text-4xl font-black tabular-nums leading-none text-slate-900 dark:text-white" style={{ fontFamily: '"Arial Black", Impact, sans-serif' }}>
                  {p.jersey_number ?? '—'}
                </span>
                <span
                  className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-1 rounded text-white text-center leading-tight max-w-[64px]"
                  style={{ background: primary }}
                >
                  {(p.positions ?? []).slice(0, 3).join(' / ') || '—'}
                </span>
              </div>

              <div className="leading-tight">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{p.first_name}</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-[color:var(--pc)] transition-colors" style={{ ['--pc' as any]: primary }}>
                  {p.last_name}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
