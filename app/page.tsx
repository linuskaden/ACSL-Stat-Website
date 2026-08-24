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
    <div>
      {/* ── Hero: big ACSL FOOTBALL over a full-bleed slideshow ── */}
      <HeroSlideshow images={images}>
        <Image
          src="/logos/ACSL-Logo.png"
          alt="ACSL"
          width={1810}
          height={525}
          priority
          className="w-auto invert drop-shadow-2xl"
          style={{ height: 'clamp(44px, 11vw, 140px)' }}
        />
        <div
          className="text-white font-black italic tracking-tight"
          style={{ fontSize: 'clamp(38px, 10.5vw, 130px)', lineHeight: 0.92, textShadow: '0 4px 30px rgba(0,0,0,0.5)' }}
        >
          FOOTBALL
        </div>
        <p className="mt-5 text-white/85 text-sm md:text-lg font-semibold uppercase tracking-[0.25em]">
          Austrian College Sports League
        </p>
      </HeroSlideshow>

      {/* ── Live banner ── */}
      {liveGame && (
        <div className="max-w-7xl mx-auto px-4 pt-8">
          <Link
            href="/live"
            className="flex items-center justify-between gap-4 bg-[#ff1d25] rounded-xl p-4 hover:bg-[#e0181f] transition-colors shadow-lg shadow-[#ff1d25]/25"
          >
            <div className="flex items-center gap-3">
              <span className="animate-pulse w-2 h-2 rounded-full bg-white inline-block" />
              <span className="font-bold text-white text-sm">LIVE NOW</span>
            </div>
            <div className="flex items-center gap-4 text-white font-bold">
              <span>{(liveGame as any).home_team?.short_name ?? '—'}</span>
              <span className="text-2xl">{liveGame.home_score ?? 0} – {liveGame.away_score ?? 0}</span>
              <span>{(liveGame as any).away_team?.short_name ?? '—'}</span>
            </div>
            <span className="text-white/70 text-xs hidden sm:block">View Live Stats →</span>
          </Link>
        </div>
      )}

      {/* ── Teams: elongated white cards, big logo left + name ── */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-slate-400 dark:text-[#7a7a7a] mb-7">
          Teams
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {(teams ?? []).map((team: Team) => (
            <Link
              key={team.id}
              href={`/teams/${team.slug}`}
              className="flex items-center gap-4 bg-white dark:bg-[#111] border border-black/[0.08] dark:border-white/10 rounded-2xl px-5 py-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-black/20 dark:hover:border-white/25 transition-all"
            >
              {team.logo_url ? (
                <img src={team.logo_url} alt="" className="w-16 h-16 md:w-[76px] md:h-[76px] object-contain shrink-0" />
              ) : (
                <span className="w-16 h-16 md:w-[76px] md:h-[76px] shrink-0" />
              )}
              <span className="font-black text-lg md:text-xl text-slate-900 dark:text-white truncate">
                {team.name}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
