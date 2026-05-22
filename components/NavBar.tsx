'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

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
  const isAdmin = pathname.startsWith('/admin')
  if (isOverlay) return null

  return (
    <nav className="sticky top-0 z-50 bg-black border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-6 h-14">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-[#ff1d25] flex items-center justify-center font-black text-white text-xs">
            AC
          </div>
          <span className="font-bold text-white tracking-wide text-sm hidden sm:block">ACSL STATS</span>
        </Link>

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
            <Link href="/admin" className="px-3 py-1.5 rounded text-sm text-[#7a7a7a] hover:text-white">Dashboard</Link>
            <Link href="/admin/players" className="px-3 py-1.5 rounded text-sm text-[#7a7a7a] hover:text-white">Players</Link>
            <Link href="/admin/games" className="px-3 py-1.5 rounded text-sm text-[#7a7a7a] hover:text-white">Games</Link>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {isAdmin ? (
            <Link href="/" className="text-xs text-[#7a7a7a] hover:text-white">← Public Site</Link>
          ) : (
            <Link href="/admin" className="text-xs text-[#7a7a7a] hover:text-white">Admin</Link>
          )}
        </div>
      </div>
    </nav>
  )
}
