import { createClient } from '@/lib/supabase/server'
import { getSelectedCompetition } from '@/lib/competition'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TeamPageNav from '@/components/TeamPageNav'
import TeamBand from '@/components/TeamBand'

export const revalidate = 60

const CHAMPIONSHIP_TYPES = ['championship', 'runner_up']

export default async function TeamAccoladesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const competition = await getSelectedCompetition()

  const { data: team } = await supabase.from('teams').select('*').eq('slug', slug).single()
  if (!team) notFound()

  const { data: rows } = await supabase
    .from('accolades')
    .select('*, player:players(id, first_name, last_name, jersey_number)')
    .eq('competition_id', competition.id)
    .eq('team_id', team.id)
    .order('season', { ascending: false, nullsFirst: false })
    .order('sort_order')

  const all = (rows ?? []) as any[]
  const titles = all.filter(a => CHAMPIONSHIP_TYPES.includes(a.type))
  const awards = all.filter(a => !CHAMPIONSHIP_TYPES.includes(a.type))
  const primary = team.primary_color || '#111'

  return (
    <div>
      <TeamBand team={team} subtitle="Accolades" />
      <TeamPageNav slug={slug} primary={primary} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {all.length === 0 ? (
          <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl p-12 text-center shadow-sm">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-slate-300 dark:text-[#555]">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
            <p className="text-slate-500 dark:text-[#7a7a7a] text-sm">Noch keine Auszeichnungen erfasst.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {titles.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: primary }}>Championships</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {titles.map(a => {
                    const isChamp = a.type === 'championship'
                    return (
                      <div key={a.id}
                        className="rounded-2xl p-5 border shadow-sm flex items-center gap-4"
                        style={isChamp
                          ? { background: `${primary}12`, borderColor: `${primary}55` }
                          : { background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={isChamp ? primary : '#9aa0b5'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" />
                          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                        </svg>
                        <div className="min-w-0">
                          <div className="font-black text-slate-900 dark:text-white leading-tight">
                            {a.title || (isChamp ? 'Champion' : 'Finalist')}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-[#7a7a7a]">
                            {a.season ?? ''}{!isChamp && ' · Finalist'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {awards.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: primary }}>MVPs &amp; Auszeichnungen</h2>
                <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-2xl overflow-hidden shadow-sm divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                  {awards.map(a => (
                    <div key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="w-14 shrink-0 text-sm font-bold tabular-nums text-slate-400 dark:text-[#7a7a7a]">{a.season ?? '—'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white">{a.title || 'MVP'}</div>
                      </div>
                      {a.player ? (
                        <Link href={`/players/${a.player.id}`} className="text-sm font-semibold text-slate-700 dark:text-[#ccc] hover:text-[#ff1d25] transition-colors truncate">
                          {a.player.jersey_number != null && <span className="text-slate-400 dark:text-[#666]">#{a.player.jersey_number} </span>}
                          {a.player.first_name} {a.player.last_name}
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
