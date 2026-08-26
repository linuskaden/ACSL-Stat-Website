'use client'
import { useState } from 'react'
import Link from 'next/link'

type Top = { id: string; name: string; jersey: number | null; value: string }
type Cat = { abbr: string; top: Top[] }
export type StatGroup = { group: string; cats: Cat[] }

export default function TeamStatsTabs({
  regular, playoff, primary,
}: {
  regular: StatGroup[]
  playoff: StatGroup[]
  primary: string
}) {
  const [mode, setMode] = useState<'regular' | 'playoff'>('regular')
  const groups = mode === 'regular' ? regular : playoff

  const TABS: { id: 'regular' | 'playoff'; label: string }[] = [
    { id: 'regular', label: 'Regular Season' },
    { id: 'playoff', label: 'Playoffs' },
  ]

  return (
    <div>
      <div className="inline-flex gap-1 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] mb-6">
        {TABS.map(t => {
          const active = mode === t.id
          return (
            <button
              key={t.id}
              onClick={() => setMode(t.id)}
              className="px-4 py-2 text-sm font-bold rounded-lg transition-colors"
              style={{
                background: active ? primary : 'transparent',
                color: active ? '#fff' : 'var(--fg-muted)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-[#555] text-sm">
          {mode === 'regular' ? 'Noch keine Regular-Season-Statistiken.' : 'Noch keine Playoff-Statistiken.'}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ group, cats }) => (
            <div key={group}>
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] mb-3" style={{ color: primary }}>{group}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cats.map(cat => (
                  <div key={cat.abbr} className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl p-4 shadow-sm">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-2">{cat.abbr}</div>
                    {cat.top.map((p, i) => (
                      <Link key={p.id} href={`/players/${p.id}`}
                        className="flex items-center gap-2 py-1.5 border-t first:border-t-0 border-black/[0.05] dark:border-white/5">
                        <span className="w-4 text-center text-xs font-black" style={{ color: i === 0 ? primary : 'var(--fg-faint)' }}>{i + 1}</span>
                        <span className={`flex-1 min-w-0 text-sm truncate ${i === 0 ? 'font-bold' : 'font-medium'} text-slate-900 dark:text-white`}>
                          {p.jersey != null && <span className="text-slate-400 dark:text-[#666]">#{p.jersey} </span>}{p.name}
                        </span>
                        <span className="text-base font-black tabular-nums text-slate-900 dark:text-white">{p.value}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
