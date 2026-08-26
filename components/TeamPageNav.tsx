'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/* Sub-navigation shared across a team's Overview / Roster / Stats pages. */
export default function TeamPageNav({ slug, primary }: { slug: string; primary: string }) {
  const pathname = usePathname()
  const base = `/teams/${slug}`
  const tabs = [
    { href: base, label: 'Übersicht' },
    { href: `${base}/roster`, label: 'Roster' },
    { href: `${base}/stats`, label: 'Stats' },
  ]

  return (
    <div className="sticky top-16 z-30 bg-[var(--bg)]/90 backdrop-blur border-b border-black/[0.07] dark:border-white/5">
      <div className="max-w-6xl mx-auto px-4 flex gap-1">
        {tabs.map(t => {
          const active = t.href === base ? pathname === base : pathname.startsWith(t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              className="px-4 py-3 text-sm font-bold transition-colors -mb-px border-b-2"
              style={{
                borderColor: active ? primary : 'transparent',
                color: active ? 'var(--fg)' : 'var(--fg-muted)',
              }}
            >
              {t.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
