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
  { href: '/fantasy', label: 'Fantasy' },
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

  // Clicking the wordmark toggles between football and basketball.
  function toggleSport() {
    const target = isBasketball ? 'football' : 'basketball'
    const parts = window.location.host.split('.')
    if (parts[0] === 'football' || parts[0] === 'basketball') {
      parts[0] = target
      window.location.href = `${window.location.protocol}//${parts.join('.')}/`
      return
    }
    const key = target === 'football' ? 'football' : 'basketball_women'
    document.cookie = `${COMPETITION_COOKIE}=${key}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    router.refresh()
  }

  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [teamsOpen, setTeamsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const teamsRef = useRef<HTMLDivElement>(null)

  // Close the dropdown / mobile menu on navigation
  useEffect(() => { setTeamsOpen(false); setMobileOpen(false) }, [pathname])

  // Close the teams dropdown on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (teamsRef.current && !teamsRef.current.contains(e.target as Node)) setTeamsOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Keep the theme in sync per route: the public site is always light; only
  // the admin area may switch to dark (and remembers the choice).
  useEffect(() => {
    const root = document.documentElement
    if (!pathname.startsWith('/admin')) {
      root.classList.remove('dark')
      return
    }
    try {
      const dark = localStorage.getItem('acsl-theme') === 'dark'
      root.classList.toggle('dark', dark)
      setTheme(dark ? 'dark' : 'light')
    } catch {}
  }, [pathname])

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
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-3 md:gap-6 h-16">
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
        </Link>

        {/* Wordmark doubles as the Football/Basketball switcher */}
        {!isAdmin && competition ? (
          <button
            onClick={toggleSport}
            title={`Zu ${isBasketball ? 'Football' : 'Basketball'} wechseln`}
            className="ml-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            {wordmark}
          </button>
        ) : (
          <span className="ml-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-[#7a7a7a] hidden sm:block">
            {wordmark}
          </span>
        )}

        {/* Nav links (desktop) */}
        {!isAdmin && (
          <div className="hidden md:flex items-center gap-1">
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
                        active ? 'text-[#16163f]' : 'text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white'
                      }`}
                      aria-expanded={teamsOpen}
                    >
                      Teams
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className="transition-transform" style={{ transform: teamsOpen ? 'rotate(180deg)' : 'none' }}>
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                      {active && <span className="absolute left-3 right-6 -bottom-[1px] h-0.5 rounded-full bg-[#16163f]" />}
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
                      ? 'text-[#16163f]'
                      : 'text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {l.label}
                  {active && (
                    <span className="absolute left-3 right-3 -bottom-[1px] h-0.5 rounded-full bg-[#16163f]" />
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {isAdmin && (
          <div className="hidden md:flex items-center gap-1">
            <Link href="/admin"         className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">Dashboard</Link>
            <Link href="/admin/players" className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">Players</Link>
            <Link href="/admin/games"   className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">Games</Link>
            <Link href="/admin/overlay" className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">Overlay</Link>
            <Link href="/admin/broadcast" className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">Broadcast</Link>
            <Link href="/admin/fantasy" className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">Fantasy</Link>
          </div>
        )}

        {/* Right side (desktop) */}
        <div className="ml-auto hidden md:flex items-center gap-2">
          {/* Herren/Damen division switch (basketball only) */}
          {isBasketball && !isAdmin && (
            <div className="flex gap-0.5 p-0.5 bg-black/[0.05] dark:bg-white/[0.06] rounded-lg">
              {([['basketball_women', 'Damen'], ['basketball_men', 'Herren']] as const).map(([key, label]) => {
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

          {/* Theme toggle + back link live in the admin area only; the public
              site stays light and uncluttered, and /admin is the way in. */}
          {isAdmin && (
            <>
              <button
                onClick={toggleTheme}
                aria-label="Toggle light/dark mode"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/5 transition-all"
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                {theme === 'dark' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              <Link href="/" className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">
                ← Public Site
              </Link>
            </>
          )}
        </div>

        {/* Hamburger (mobile) */}
        <button
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Menü"
          aria-expanded={mobileOpen}
          className="ml-auto md:hidden w-10 h-10 -mr-2 flex items-center justify-center text-slate-700 dark:text-white"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-black/[0.08] dark:border-white/10 bg-white dark:bg-black px-4 py-1">
          {!isAdmin && links.map(l => {
            // "Teams" is a dropdown on desktop; on mobile, list the teams inline.
            if (l.href === '/teams') {
              return (
                <div key={l.href} className="border-b border-black/[0.05] dark:border-white/[0.06] py-2">
                  <div className="px-1 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a]">Teams</div>
                  {teams.length === 0 ? (
                    <div className="px-1 py-2 text-sm text-slate-400 dark:text-[#7a7a7a]">Keine Teams</div>
                  ) : teams.map(t => (
                    <Link key={t.slug} href={`/teams/${t.slug}`} onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2.5 px-1 py-2 text-sm font-semibold text-slate-700 dark:text-[#cfcfcf]">
                      {t.logo_url
                        ? <img src={t.logo_url} alt="" className="w-6 h-6 object-contain shrink-0" />
                        : <span className="w-6 h-6 rounded shrink-0" style={{ background: t.primary_color }} />}
                      <span className="truncate">{t.name}</span>
                    </Link>
                  ))}
                </div>
              )
            }
            const active = pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-1 py-3 border-b border-black/[0.05] dark:border-white/[0.06] text-base font-semibold ${
                  active ? 'text-[#16163f] dark:text-white' : 'text-slate-700 dark:text-[#cfcfcf]'
                }`}
              >
                {l.label}
              </Link>
            )
          })}
          {isAdmin && ([
            ['/admin', 'Dashboard'], ['/admin/players', 'Players'], ['/admin/games', 'Games'],
            ['/admin/overlay', 'Overlay'], ['/admin/broadcast', 'Broadcast'], ['/admin/fantasy', 'Fantasy'], ['/', '← Public Site'],
          ] as [string, string][]).map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className="block px-1 py-3 border-b border-black/[0.05] dark:border-white/[0.06] text-base font-semibold text-slate-700 dark:text-[#cfcfcf]">
              {label}
            </Link>
          ))}
          <div className="flex items-center justify-between gap-3 py-3">
            {!isAdmin && competition && (
              <button onClick={() => { toggleSport(); setMobileOpen(false) }}
                className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#7a7a7a]">
                Zu {isBasketball ? 'Football' : 'Basketball'} wechseln
              </button>
            )}
            <div className="ml-auto"><SeasonSwitcher /></div>
          </div>
        </div>
      )}
    </nav>
  )
}
