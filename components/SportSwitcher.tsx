'use client'
import { useRouter } from 'next/navigation'
import { COMPETITION_COOKIE } from '@/lib/competition-client'

/* Top-left Football/Basketball toggle. On a sport subdomain it navigates to
   the sibling subdomain; otherwise (vercel.app, localhost) it flips the
   acsl-competition cookie. */
export default function SportSwitcher({ sport }: { sport: 'football' | 'basketball' }) {
  const router = useRouter()

  function go(target: 'football' | 'basketball') {
    if (target === sport) return
    const parts = window.location.host.split('.')
    if (parts[0] === 'football' || parts[0] === 'basketball') {
      parts[0] = target
      window.location.href = `${window.location.protocol}//${parts.join('.')}/`
      return
    }
    const key = target === 'football' ? 'football' : 'basketball_men'
    document.cookie = `${COMPETITION_COOKIE}=${key}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    router.refresh()
  }

  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.06]">
      {(['football', 'basketball'] as const).map(s => {
        const active = sport === s
        return (
          <button
            key={s}
            onClick={() => go(s)}
            aria-pressed={active}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
              active
                ? 'bg-white dark:bg-[#222] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {s === 'football' ? 'Football' : 'Basketball'}
          </button>
        )
      })}
    </div>
  )
}
