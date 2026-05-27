'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const links = [
  { href: '/', label: 'Home' },
  { href: '/teams', label: 'Teams' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/playoffs', label: 'Playoffs' },
  { href: '/players', label: 'Players' },
  { href: '/live', label: 'Live' },
]

export default function NavBar() {
  const pathname = usePathname()
  const isOverlay = pathname.startsWith('/overlay')
  const isAdmin   = pathname.startsWith('/admin')

  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  // Read stored theme on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('acsl-theme')
      if (stored === 'light') setTheme('light')
    } catch {}
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem('acsl-theme', next) } catch {}
    if (next === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }

  if (isOverlay) return null

  return (
    <nav className="sticky top-0 z-50 bg-black border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-[#ff1d25] flex items-center justify-center font-black text-white text-xs">
            AC
          </div>
          <span className="font-bold text-white tracking-wide text-sm hidden sm:block">ACSL STATS</span>
        </Link>

        {/* Nav links */}
        {!isAdmin && (
          <div className="flex items-center gap-1">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  pathname === l.href
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-[#7a7a7a] hover:text-white hover:bg-white/5'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="flex items-center gap-1">
            <Link href="/admin"         className="px-3 py-1.5 rounded text-sm text-[#7a7a7a] hover:text-white">Dashboard</Link>
            <Link href="/admin/players" className="px-3 py-1.5 rounded text-sm text-[#7a7a7a] hover:text-white">Players</Link>
            <Link href="/admin/games"   className="px-3 py-1.5 rounded text-sm text-[#7a7a7a] hover:text-white">Games</Link>
          </div>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle light/dark mode"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7a7a7a] hover:text-white hover:bg-white/5 transition-all text-base"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {isAdmin ? (
            <Link href="/"      className="text-xs text-[#7a7a7a] hover:text-white">← Public Site</Link>
          ) : (
            <Link href="/admin" className="text-xs text-[#7a7a7a] hover:text-white">Admin</Link>
          )}
        </div>
      </div>
    </nav>
  )
}
