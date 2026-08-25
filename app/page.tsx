import fs from 'fs'
import path from 'path'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import type { Team } from '@/lib/supabase/types'
import HeroSlideshow from '@/components/HeroSlideshow'

export const revalidate = 30

/** All images in public/slideshow (added simply by dropping files in). */
function slideshowImages(): string[] {
  try {
    const dir = path.join(process.cwd(), 'public', 'slideshow')
    return fs
      .readdirSync(dir)
      .filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
      .map(f => `/slideshow/${encodeURIComponent(f)}`)
  } catch {
    return []
  }
}

export default async function HomePage() {
  const supabase = await createClient()
  const images = slideshowImages()

  const [{ data: teams }, { data: liveGame }] = await Promise.all([
    supabase.from('teams').select('*').order('name'),
    supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
      .eq('status', 'live')
      .limit(1)
      .maybeSingle(),
  ])

  const teamList = (teams ?? []) as Team[]
  const leftTeams = teamList.slice(0, 3)
  const rightTeams = teamList.slice(3, 6)

  return (
    // Full-screen slideshow (viewport minus the 4rem navbar) — no scrolling.
    <div className="relative overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
      {/* ── Full-bleed hero slideshow with the centred title ── */}
      <HeroSlideshow images={images}>
        <Image
          src="/logos/ACSL-Logo.png"
          alt="ACSL"
          width={1810}
          height={525}
          priority
          className="w-auto invert drop-shadow-2xl"
          style={{ height: 'clamp(40px, 10vw, 130px)' }}
        />
        <div
          className="text-white font-black italic tracking-tight"
          style={{ fontSize: 'clamp(34px, 9.5vw, 118px)', lineHeight: 0.92, textShadow: '0 4px 30px rgba(0,0,0,0.5)' }}
        >
          FOOTBALL
        </div>
        <p className="mt-4 text-white/85 text-[11px] md:text-base font-semibold uppercase tracking-[0.25em]">
          Austrian College Sports League
        </p>
      </HeroSlideshow>

      {/* ── 3 team logos on each side, over the slideshow ── */}
      {[{ side: 'left', teams: leftTeams }, { side: 'right', teams: rightTeams }].map(col => (
        <div
          key={col.side}
          className={`absolute top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-6 md:gap-12 ${col.side === 'left' ? 'left-[2vw] md:left-[3.5%]' : 'right-[2vw] md:right-[3.5%]'}`}
        >
          {col.teams.map(team => (
            <Link key={team.id} href={`/teams/${team.slug}`} title={team.name} aria-label={team.name} className="block hover:scale-110 transition-transform duration-200">
              {team.logo_url && (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="object-contain drop-shadow-[0_3px_14px_rgba(0,0,0,0.65)]"
                  style={{ width: 'clamp(52px, 7vw, 96px)', height: 'clamp(52px, 7vw, 96px)' }}
                />
              )}
            </Link>
          ))}
        </div>
      ))}

      {/* ── Live banner (thin, bottom centre) ── */}
      {liveGame && (
        <Link
          href="/live"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-[#ff1d25] rounded-lg px-4 py-1.5 text-white font-bold text-xs hover:bg-[#e0181f] transition-colors shadow-lg"
        >
          <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-white inline-block" />
          LIVE: {(liveGame as any).home_team?.short_name ?? '—'} {liveGame.home_score ?? 0}–{liveGame.away_score ?? 0} {(liveGame as any).away_team?.short_name ?? '—'} →
        </Link>
      )}
    </div>
  )
}
