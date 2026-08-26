import fs from 'fs'
import path from 'path'
import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason } from '@/lib/season'
import { computeRecords, computeForm, type FormResult } from '@/lib/records'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TeamHeroBg from '@/components/TeamHeroBg'
import TeamPageNav from '@/components/TeamPageNav'

export const revalidate = 60

/** Focal point from a filename suffix: `--top` / `--center` / `--bottom`
    or `--y<0-100>` for an exact vertical position. Default: centered. */
function focusToPosition(nameNoExt: string): string {
  const m = nameNoExt.match(/--(top|center|bottom|y\d{1,3})$/i)
  if (!m) return '50% 50%'
  const tok = m[1].toLowerCase()
  if (tok === 'top') return '50% 15%'
  if (tok === 'bottom') return '50% 85%'
  if (tok === 'center') return '50% 50%'
  const y = Math.min(100, Math.max(0, parseInt(tok.slice(1), 10)))
  return `50% ${y}%`
}

type HeroImage = { src: string; position: string }

/** Photos in public/teams/<slug>/ (drop files in — shown automatically).
    Sort + focal point come from the filename (see focusToPosition). */
function teamHeroImages(slug: string): HeroImage[] {
  try {
    const dir = path.join(process.cwd(), 'public', 'teams', slug)
    return fs.readdirSync(dir)
      .filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f))
      .sort()
      .map(f => ({
        src: `/teams/${slug}/${encodeURIComponent(f)}`,
        position: focusToPosition(f.replace(/\.[^.]+$/, '')),
      }))
  } catch {
    return []
  }
}

const LEADER_CATS: { label: string; get: (r: any) => number; unit?: string }[] = [
  { label: 'Passing Yards',   get: r => r.pass_yards ?? 0, unit: 'YDS' },
  { label: 'Rushing Yards',   get: r => (r.rush_yards ?? 0) + (r.qb_rush_yards ?? 0), unit: 'YDS' },
  { label: 'Receiving Yards', get: r => (r.rec_yards ?? 0) + (r.rb_rec_yards ?? 0), unit: 'YDS' },
  { label: 'Sacks',           get: r => r.sacks ?? 0, unit: 'SCK' },
]

export default async function TeamOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const season = await getSelectedSeason()

  const { data: team } = await supabase.from('teams').select('*').eq('slug', slug).single()
  if (!team) notFound()

  const [{ data: games }, { data: standings }, { data: careerRows }] = await Promise.all([
    supabase
      .from('games')
      .select('*, home_team:teams!games_home_team_id_fkey(*), away_team:teams!games_away_team_id_fkey(*)')
      .eq('season', season)
      .order('scheduled_at', { nullsFirst: false }),
    supabase.from('standings').select('*, team:teams(*)').eq('season', season),
    supabase
      .from('career_stats')
      .select('*, player:players!inner(id, first_name, last_name, jersey_number, positions, team_id)')
      .eq('season', season),
  ])

  const allGames = (games ?? []) as any[]
  const teamGames = allGames.filter(g => g.home_team_id === team.id || g.away_team_id === team.id)

  const recordByTeam = computeRecords(allGames)
  const formByTeam = computeForm(allGames)
  const record = recordByTeam[team.id] ?? '0-0'
  const form = (formByTeam[team.id] ?? []) as FormResult[]

  // Standings snapshot (rank + PF/PA)
  const sortedStandings = [...(standings ?? [])].sort((a: any, b: any) =>
    (a.playoff_seed ?? 999) - (b.playoff_seed ?? 999) || (b.wins ?? 0) - (a.wins ?? 0) || (b.points_for ?? 0) - (a.points_for ?? 0))
  const myRankIdx = sortedStandings.findIndex((s: any) => s.team_id === team.id)
  const myStanding = myRankIdx >= 0 ? (sortedStandings[myRankIdx] as any) : null
  const rank = myRankIdx >= 0 ? myRankIdx + 1 : null

  // Upcoming (scheduled/live) + recent (final)
  const upcoming = teamGames
    .filter(g => g.status === 'scheduled' || g.status === 'live')
    .slice(0, 3)
  const recent = teamGames
    .filter(g => g.status === 'final')
    .slice()
    .reverse()
    .slice(0, 3)

  // Selected stat leaders (top player per key category)
  const teamCareer = (careerRows ?? []).filter((r: any) => r.player?.team_id === team.id)
  const topLeaders = LEADER_CATS.map(cat => {
    const ranked = teamCareer
      .map((r: any) => ({ r, v: cat.get(r) }))
      .filter((x: any) => x.v > 0)
      .sort((a: any, b: any) => b.v - a.v)
    const best = ranked[0]
    return best ? {
      label: cat.label, unit: cat.unit,
      name: `${best.r.player.first_name} ${best.r.player.last_name}`,
      jersey: best.r.player.jersey_number as number | null,
      id: best.r.player.id as string,
      value: Math.round(best.v),
    } : null
  }).filter(Boolean) as { label: string; unit?: string; name: string; jersey: number | null; id: string; value: number }[]

  const images = teamHeroImages(slug)
  const primary = team.primary_color || '#111'
  const secondary = team.secondary_color || primary

  return (
    <div>
      {/* ── Hero ── */}
      <TeamHeroBg images={images} primary={primary} secondary={secondary}>
        <div className="max-w-6xl mx-auto px-4 w-full flex flex-col justify-end" style={{ minHeight: 'clamp(340px, 52vh, 560px)' }}>
          <div className="pb-6 pt-16">
            <div className="flex items-end gap-5">
              {team.logo_url && (
                <img src={team.logo_url} alt="" className="w-24 h-24 md:w-32 md:h-32 object-contain drop-shadow-2xl shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-white/80 text-xs md:text-sm font-semibold uppercase tracking-[0.2em] mb-1 drop-shadow">
                  {team.university}
                </div>
                <h1 className="text-white font-black italic tracking-tight leading-[0.9] drop-shadow-xl" style={{ fontSize: 'clamp(38px, 7vw, 80px)' }}>
                  {team.name}
                </h1>
              </div>
            </div>

            {/* Stat row */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <HeroStat label="Record" value={record} />
              {rank && <HeroStat label="Platz" value={`#${rank}`} />}
              {myStanding && <HeroStat label="PF" value={String(myStanding.points_for ?? 0)} />}
              {myStanding && <HeroStat label="PA" value={String(myStanding.points_against ?? 0)} />}
              {form.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-white/10 backdrop-blur border border-white/15">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/70">Form</span>
                  <div className="flex gap-1">
                    {form.map((r, i) => (
                      <span key={i} className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black text-white"
                        style={{ background: r === 'W' ? '#04a550' : r === 'L' ? '#ff1d25' : 'rgba(255,255,255,0.3)' }}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </TeamHeroBg>

      <TeamPageNav slug={slug} primary={primary} />

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column: games */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Nächste Spiele" primary={primary}>
            {upcoming.length === 0 ? (
              <Empty>Keine anstehenden Spiele.</Empty>
            ) : (
              <div className="space-y-2">
                {upcoming.map(g => <GameRow key={g.id} game={g} teamId={team.id} />)}
              </div>
            )}
          </Card>

          <Card title="Letzte Ergebnisse" primary={primary}>
            {recent.length === 0 ? (
              <Empty>Noch keine gespielten Spiele.</Empty>
            ) : (
              <div className="space-y-2">
                {recent.map(g => <GameRow key={g.id} game={g} teamId={team.id} final />)}
              </div>
            )}
          </Card>

          {/* Top performers */}
          <Card title="Top Performer" primary={primary}
            action={<Link href={`/teams/${slug}/stats`} className="text-xs font-bold" style={{ color: primary }}>Alle Stats →</Link>}>
            {topLeaders.length === 0 ? (
              <Empty>Noch keine Statistiken.</Empty>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {topLeaders.map(l => (
                  <Link key={l.label} href={`/players/${l.id}`}
                    className="rounded-xl border border-black/[0.06] dark:border-white/5 p-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-1">{l.label}</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black tabular-nums text-slate-900 dark:text-white">{l.value}</span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-[#7a7a7a]">{l.unit}</span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-[#bbb] truncate mt-0.5">
                      {l.jersey != null && <span className="text-slate-400 dark:text-[#666]">#{l.jersey} </span>}{l.name}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right column: standings + roster link */}
        <div className="space-y-6">
          <Card title="Tabelle" primary={primary}
            action={<Link href="/standings" className="text-xs font-bold" style={{ color: primary }}>Ganze Tabelle →</Link>}>
            <div className="space-y-1">
              {sortedStandings.map((s: any, i: number) => {
                const me = s.team_id === team.id
                return (
                  <Link key={s.id} href={`/teams/${s.team?.slug ?? ''}`}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors"
                    style={{ background: me ? `${primary}14` : 'transparent' }}>
                    <span className="w-4 text-center text-xs font-bold tabular-nums text-slate-400 dark:text-[#7a7a7a]">{i + 1}</span>
                    {s.team?.logo_url
                      ? <img src={s.team.logo_url} alt="" className="w-6 h-6 object-contain shrink-0" />
                      : <span className="w-6 h-6 rounded shrink-0" style={{ background: s.team?.primary_color }} />}
                    <span className={`flex-1 text-sm truncate ${me ? 'font-black' : 'font-medium'} text-slate-900 dark:text-white`}>{s.team?.short_name}</span>
                    <span className="text-xs font-bold tabular-nums text-slate-500 dark:text-[#7a7a7a]">{s.wins ?? 0}-{s.losses ?? 0}</span>
                  </Link>
                )
              })}
            </div>
          </Card>

          <Link href={`/teams/${slug}/roster`}
            className="block rounded-2xl p-5 text-white shadow-sm hover:shadow-md transition-all"
            style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
            <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Kader</div>
            <div className="text-xl font-black flex items-center justify-between">Zum Roster <span>→</span></div>
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */
function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-2 bg-white/10 backdrop-blur border border-white/15 text-center">
      <div className="text-lg md:text-xl font-black text-white tabular-nums leading-none">{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-white/70 mt-1">{label}</div>
    </div>
  )
}

function Card({ title, primary, action, children }: { title: string; primary: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: primary }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-400 dark:text-[#555] py-4 text-center">{children}</div>
}

function GameRow({ game, teamId, final }: { game: any; teamId: string; final?: boolean }) {
  const isHome = game.home_team_id === teamId
  const opp = isHome ? game.away_team : game.home_team
  const my = isHome ? game.home_team : game.away_team
  const myScore = isHome ? game.home_score : game.away_score
  const opScore = isHome ? game.away_score : game.home_score
  const won = final && myScore != null && opScore != null && myScore > opScore
  const lost = final && myScore != null && opScore != null && myScore < opScore
  const date = game.scheduled_at
    ? new Date(game.scheduled_at).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : 'TBD'
  const time = game.scheduled_at
    ? new Date(game.scheduled_at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <Link href={`/games/${game.id}`} className="flex items-center gap-3 rounded-xl border border-black/[0.06] dark:border-white/5 px-3 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
      <div className="w-16 shrink-0 text-center">
        <div className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">{date}</div>
        <div className="text-[10px] text-slate-400 dark:text-[#7a7a7a]">{final ? 'Final' : time}</div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-[#7a7a7a] shrink-0">
        <span>{isHome ? 'vs' : '@'}</span>
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {opp?.logo_url && <img src={opp.logo_url} alt="" className="w-6 h-6 object-contain shrink-0" />}
        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">{opp?.short_name ?? 'TBD'}</span>
      </div>
      {final ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-black uppercase w-4 text-center"
            style={{ color: won ? '#04a550' : lost ? '#ff1d25' : '#7a7a7a' }}>
            {won ? 'W' : lost ? 'L' : 'T'}
          </span>
          <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white">{myScore ?? 0}–{opScore ?? 0}</span>
        </div>
      ) : (
        <span className="text-xs text-slate-400 dark:text-[#7a7a7a] shrink-0 truncate max-w-[120px]">{game.location ?? ''}</span>
      )}
    </Link>
  )
}
