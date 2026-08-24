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

  return (
    // Fills exactly one screen (viewport minus the 4rem navbar) — no scrolling.
    <div className="relative overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
      {/* ── Hero slideshow fills the whole area ── */}
      <HeroSlideshow images={images}>
        <div className="flex flex-col items-center" style={{ paddingBottom: '6rem' }}>
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
        </div>
      </HeroSlideshow>

      {/* ── Frosted-glass team bar merging into the bottom of the hero ── */}
      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/40 dark:border-white/10 bg-white/60 dark:bg-black/45 backdrop-blur-md">
        <div className="max-w-7xl w-full mx-auto px-3 md:px-4 py-3 space-y-2">
          {liveGame && (
            <Link
              href="/live"
              className="flex items-center justify-center gap-2 bg-[#ff1d25] rounded-lg px-4 py-1.5 text-white font-bold text-xs hover:bg-[#e0181f] transition-colors"
            >
              <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-white inline-block" />
              LIVE: {(liveGame as any).home_team?.short_name ?? '—'} {liveGame.home_score ?? 0}–{liveGame.away_score ?? 0} {(liveGame as any).away_team?.short_name ?? '—'} →
            </Link>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 md:gap-3">
            {(teams ?? []).map((team: Team) => (
              <Link
                key={team.id}
                href={`/teams/${team.slug}`}
                className="relative flex items-center gap-2 overflow-hidden rounded-lg bg-white/85 dark:bg-white/10 border border-black/[0.06] dark:border-white/10 px-2.5 md:px-3 py-2 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                {/* team-colour accent bar */}
                <span className="absolute top-0 inset-x-0 h-1" style={{ background: team.primary_color ?? '#ff1d25' }} />
                {team.logo_url && (
                  <img src={team.logo_url} alt="" className="w-8 h-8 md:w-10 md:h-10 object-contain shrink-0" />
                )}
                <span className="font-black text-[11px] md:text-[13px] leading-tight text-slate-900 dark:text-white">
                  {team.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
