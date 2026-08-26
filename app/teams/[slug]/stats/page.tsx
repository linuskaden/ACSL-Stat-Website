import { createClient } from '@/lib/supabase/server'
import { getSelectedSeason } from '@/lib/season'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TeamPageNav from '@/components/TeamPageNav'
import TeamBand from '@/components/TeamBand'

export const revalidate = 60

/* Team-leader categories (all incl. kicking). Values use merged columns so
   multi-position players count everywhere, consistent with /leaders. */
const CATS: { group: string; abbr: string; get: (r: any) => number | null; fmt?: (v: number) => string }[] = [
  { group: 'Passing',   abbr: 'Pass YDS', get: r => r.pass_yards ?? 0 },
  { group: 'Passing',   abbr: 'Pass TDs', get: r => r.pass_tds ?? 0 },
  { group: 'Passing',   abbr: 'Comp %',   get: r => (r.pass_attempts ?? 0) >= 5 ? (r.pass_completions ?? 0) / r.pass_attempts * 100 : null, fmt: v => `${v.toFixed(1)}%` },
  { group: 'Rushing',   abbr: 'Rush YDS', get: r => (r.rush_yards ?? 0) + (r.qb_rush_yards ?? 0) },
  { group: 'Rushing',   abbr: 'Rush TDs', get: r => (r.rush_tds ?? 0) + (r.qb_rush_tds ?? 0) },
  { group: 'Receiving', abbr: 'Rec YDS',  get: r => (r.rec_yards ?? 0) + (r.rb_rec_yards ?? 0) },
  { group: 'Receiving', abbr: 'Rec',      get: r => (r.receptions ?? 0) + (r.rb_receptions ?? 0) },
  { group: 'Receiving', abbr: 'Rec TDs',  get: r => r.rec_tds ?? 0 },
  { group: 'Defense',   abbr: 'Sacks',    get: r => r.sacks ?? 0, fmt: v => v.toFixed(1) },
  { group: 'Defense',   abbr: 'Def INT',  get: r => r.def_interceptions ?? 0 },
  { group: 'Kicking',   abbr: 'FG',       get: r => r.fg_made ?? 0 },
  { group: 'Kicking',   abbr: 'EP',       get: r => r.ep_made ?? 0 },
  { group: 'Kicking',   abbr: 'PTS',      get: r => (r.fg_made ?? 0) * 3 + (r.ep_made ?? 0) },
]

type Top = { id: string; name: string; jersey: number | null; value: string }

export default async function TeamStatsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const season = await getSelectedSeason()

  const { data: team } = await supabase.from('teams').select('*').eq('slug', slug).single()
  if (!team) notFound()

  const { data: careerRows } = await supabase
    .from('career_stats')
    .select('*, player:players!inner(id, first_name, last_name, jersey_number, positions, team_id)')
    .eq('season', season)

  const rows = (careerRows ?? []).filter((r: any) => r.player?.team_id === team.id)

  const leaders = CATS.map(cat => {
    const top: Top[] = rows
      .map((r: any) => ({ r, v: cat.get(r) }))
      .filter((x: any) => x.v != null && x.v > 0)
      .sort((a: any, b: any) => b.v - a.v)
      .slice(0, 3)
      .map(({ r, v }: any) => ({
        id: r.player.id, name: `${r.player.first_name} ${r.player.last_name}`,
        jersey: r.player.jersey_number ?? null,
        value: cat.fmt ? cat.fmt(v) : String(Math.round(v)),
      }))
    return { group: cat.group, abbr: cat.abbr, top }
  }).filter(c => c.top.length > 0)

  const primary = team.primary_color || '#111'
  const groups = ['Passing', 'Rushing', 'Receiving', 'Defense', 'Kicking']
    .map(g => ({ group: g, cats: leaders.filter(l => l.group === g) }))
    .filter(g => g.cats.length > 0)

  return (
    <div>
      <TeamBand team={team} subtitle={`Team-Statistiken · Saison ${season}`} />
      <TeamPageNav slug={slug} primary={primary} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {groups.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-[#555] text-sm">Noch keine Statistiken für diese Saison.</div>
        ) : (
          <div className="space-y-8">
            {groups.map(({ group, cats }) => (
              <div key={group}>
                <h2 className="text-xs font-bold uppercase tracking-[0.15em] mb-3" style={{ color: primary }}>{group}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cats.map(cat => (
                    <div key={cat.abbr} className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl p-4 shadow-sm">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-2">{cat.abbr}</div>
                      {cat.top.map((p, i) => (
                        <Link key={p.id} href={`/players/${p.id}`}
                          className="flex items-center gap-2 py-1.5 border-t first:border-t-0 border-black/[0.05] dark:border-white/5">
                          <span className="w-4 text-center text-xs font-black" style={{ color: i === 0 ? primary : 'var(--fg-faint)' }}>{i + 1}</span>
                          <span className={`flex-1 min-w-0 text-sm truncate ${i === 0 ? 'font-bold' : 'font-medium'} text-slate-900 dark:text-white`}>
                            {p.jersey != null && <span className="text-slate-400 dark:text-[#666]">#{p.jersey} </span>}{p.name}
                          </span>
                          <span className="text-base font-black tabular-nums text-slate-900 dark:text-white">{p.value}</span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
