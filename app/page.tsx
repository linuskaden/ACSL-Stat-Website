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
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 4rem)' }}>
      {/* ── Hero: fills the remaining space ── */}
      <div className="relative flex-1 min-h-0">
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
      </div>

      {/* ── Live banner (thin) ── */}
      {liveGame && (
        <div className="shrink-0 px-3 md:px-4 pt-2">
          <Link
            href="/live"
            className="max-w-7xl mx-auto flex items-center justify-center gap-3 bg-[#ff1d25] rounded-lg px-4 py-2 text-white font-bold text-sm hover:bg-[#e0181f] transition-colors"
          >
            <span className="animate-pulse w-2 h-2 rounded-full bg-white inline-block" />
            LIVE: {(liveGame as any).home_team?.short_name ?? '—'} {liveGame.home_score ?? 0}–{liveGame.away_score ?? 0} {(liveGame as any).away_team?.short_name ?? '—'} →
          </Link>
        </div>
      )}

      {/* ── Teams: one compact row of white cards ── */}
      <section className="shrink-0 max-w-7xl w-full mx-auto px-3 md:px-4 py-3 md:py-4">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 md:gap-3">
          {(teams ?? []).map((team: Team) => (
            <Link
              key={team.id}
              href={`/teams/${team.slug}`}
              className="flex items-center gap-2 md:gap-2.5 bg-white dark:bg-[#111] border border-black/[0.08] dark:border-white/10 rounded-xl px-2.5 md:px-3 py-2 md:py-2.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-black/20 dark:hover:border-white/25 transition-all"
            >
              {team.logo_url && (
                <img src={team.logo_url} alt="" className="w-9 h-9 md:w-11 md:h-11 object-contain shrink-0" />
              )}
              <span className="font-black text-[11px] md:text-sm leading-tight text-slate-900 dark:text-white">
                {team.name}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
