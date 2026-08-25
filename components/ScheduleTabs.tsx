'use client'
import { useState } from 'react'

type TabId = 'regular' | 'playoffs' | 'bracket'

export default function ScheduleTabs({
  regular,
  playoffs,
  bracket,
}: {
  regular: React.ReactNode
  playoffs: React.ReactNode
  bracket: React.ReactNode
}) {
  const [tab, setTab] = useState<TabId>('regular')

  const TABS: { id: TabId; label: string }[] = [
    { id: 'regular', label: 'Regular Season' },
    { id: 'playoffs', label: 'Playoffs' },
    { id: 'bracket', label: 'Bracket' },
  ]

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-black/[0.08] dark:border-white/10">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-bold transition-colors -mb-px border-b-2 ${
              tab === t.id
                ? 'border-[#ff1d25] text-slate-900 dark:text-white'
                : 'border-transparent text-slate-400 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={tab === 'regular' ? '' : 'hidden'}>{regular}</div>
      <div className={tab === 'playoffs' ? '' : 'hidden'}>{playoffs}</div>
      <div className={tab === 'bracket' ? '' : 'hidden'}>{bracket}</div>
    </div>
  )
}
