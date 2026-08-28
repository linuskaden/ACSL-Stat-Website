'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import SeasonSwitcher from '@/components/SeasonSwitcher'
import { COMPETITION_COOKIE, type Competition } from '@/lib/competition-client'

type NavTeam = { slug: string; name: string; short_name: string; logo_url: string | null; primary_color: string }

const links = [
  { href: '/teams', label: 'Teams' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/standings', label: 'Standings' },
  { href: '/players', label: 'Players' },
  { href: '/stats', label: 'Stats' },
  { href: '/live', label: 'Live' },
]

export default function NavBar({ teams = [], competition }: { teams?: NavTeam[]; competition?: Competition }) {
  const pathname = usePathname()
  const router = useRouter()
  const isOverlay = pathname.startsWith('/overlay')
  const isAdmin   = pathname.startsWith('/admin')
  const isBasketball = competition?.sport === 'basketball'
  const wordmark = isBasketball ? 'Basketball' : 'Football'

  function setDivision(key: 'basketball_men' | 'basketball_women') {
    document.cookie = `${COMPETITION_COOKIE}=${key}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    router.refresh()
  }

  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [teamsOpen, setTeamsOpen] = useState(false)
  const teamsRef = useRef<HTMLDivElement>(null)

  // Close the teams dropdown on navigation
  useEffect(() => { setTeamsOpen(false) }, [pathname])

  // Close the teams dropdown on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (teamsRef.current && !teamsRef.current.contains(e.target as Node)) setTeamsOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Read stored theme on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('acsl-theme')
      if (stored === 'dark') setTheme('dark')
    } catch {}
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem('acsl-theme', next) } catch {}
    if (next === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  if (isOverlay) return null

  return (
    <nav className="sticky top-0 z-50 bg-white/90 dark:bg-black/90 backdrop-blur border-b border-black/[0.08] dark:border-white/10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-16">
        {/* Logo — black ACSL wordmark; inverted to white in dark mode */}
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/logos/ACSL-Logo.png"
            alt="ACSL"
            width={1810}
            height={525}
            priority
            className="h-6 w-auto dark:invert"
          />
          <span className="ml-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-[#7a7a7a] hidden sm:block">
            {wordmark}
          </span>
        </Link>

        {/* Nav links */}
        {!isAdmin && (
          <div className="flex items-center gap-1">
            {links.map(l => {
              // "Teams" is a dropdown of all teams, not a page link
              if (l.href === '/teams') {
                const active = pathname === '/teams' || pathname.startsWith('/teams/')
                return (
                  <div key={l.href} ref={teamsRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setTeamsOpen(o => !o)}
                      className={`relative flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        active ? 'text-[#ff1d25]' : 'text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white'
                      }`}
                      aria-expanded={teamsOpen}
                    >
                      Teams
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className="transition-transform" style={{ transform: teamsOpen ? 'rotate(180deg)' : 'none' }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                      {active && <span className="absolute left-3 right-6 -bottom-[1px] h-0.5 rounded-full bg-[#ff1d25]" />}
                    </button>

                    {teamsOpen && (
                      <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-[#111] shadow-lg py-1.5 z-50">
                        {teams.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-slate-400 dark:text-[#7a7a7a]">Keine Teams</div>
                        ) : teams.map(t => {
                          const isActive = pathname === `/teams/${t.slug}` || pathname.startsWith(`/teams/${t.slug}/`)
                          return (
                            <Link
                              key={t.slug}
                              href={`/teams/${t.slug}`}
                              onClick={() => setTeamsOpen(false)}
                              className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                              style={{ background: isActive ? `${t.primary_color}14` : undefined }}
                            >
                              {t.logo_url
                                ? <img src={t.logo_url} alt="" className="w-7 h-7 object-contain shrink-0" />
                                : <span className="w-7 h-7 rounded shrink-0" style={{ background: t.primary_color }} />}
                              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{t.name}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              const active = pathname === l.href
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`relative px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active
                      ? 'text-[#ff1d25]'
                      : 'text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {l.label}
                  {active && (
                    <span className="absolute left-3 right-3 -bottom-[1px] h-0.5 rounded-full bg-[#ff1d25]" />
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center gap-1">
            <Link href="/admin"         className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">Dashboard</Link>
            <Link href="/admin/players" className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">Players</Link>
            <Link href="/admin/games"   className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">Games</Link>
            <Link href="/admin/overlay" className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">Overlay</Link>
            <Link href="/admin/broadcast" className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">Broadcast</Link>
          </div>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {/* Herren/Damen division switch (basketball only) */}
          {isBasketball && !isAdmin && (
            <div className="flex gap-0.5 p-0.5 bg-black/[0.05] dark:bg-white/[0.06] rounded-lg">
              {([['basketball_men', 'Herren'], ['basketball_women', 'Damen']] as const).map(([key, label]) => {
                const active = competition?.key === key
                return (
                  <button key={key} onClick={() => setDivision(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${active ? 'bg-white dark:bg-[#222] text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white'}`}>
                    {label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Season switcher */}
          <SeasonSwitcher />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle light/dark mode"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/5 transition-all"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? (
              // Sun
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              // Moon
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {isAdmin ? (
            <Link href="/" className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">
              ← Public Site
            </Link>
          ) : (
            <Link
              href="/admin"
              aria-label="Admin"
              title="Admin"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/5 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
