'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_SEASON = 2026
const COOKIE = 'acsl-season'

function readSeasonCookie(): number {
  if (typeof document === 'undefined') return DEFAULT_SEASON
  const m = document.cookie.match(/(?:^|;\s*)acsl-season=(\d+)/)
  return m ? parseInt(m[1], 10) : DEFAULT_SEASON
}

export default function SeasonSwitcher() {
  const router = useRouter()
  const [seasons, setSeasons] = useState<number[]>([DEFAULT_SEASON])
  const [season, setSeason] = useState<number>(DEFAULT_SEASON)

  useEffect(() => {
    setSeason(readSeasonCookie())
    const supabase = createClient()
    supabase.from('games').select('season').then(({ data }) => {
      const set = new Set<number>([DEFAULT_SEASON])
      ;(data ?? []).forEach((r: { season: number | null }) => {
        if (r.season) set.add(r.season)
      })
      setSeasons([...set].sort((a, b) => b - a))
    })
  }, [])

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = parseInt(e.target.value, 10)
    setSeason(next)
    document.cookie = `${COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    router.refresh()
  }

  return (
    <select
      value={season}
      onChange={onChange}
      aria-label="Season"
      title="Season"
      className="bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 dark:text-white focus:outline-none focus:border-[#ff1d25] cursor-pointer"
    >
      {seasons.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}
