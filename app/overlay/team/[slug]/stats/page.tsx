'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const QUARTERS = ['Q1','Q2','Q3','Q4','OT']

export default function TeamStatsOverlay({ params, searchParams }: {
  params: { slug: string }; searchParams: { game_id?: string }
}) {
  const [team, setTeam] = useState<any>(null)
  const [totals, setTotals] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: t } = await supabase.from('teams').select('*').eq('slug', params.slug).single()
      setTeam(t)
      if (!t) return

      if (searchParams.game_id) {
        const { data: gs } = await supabase
          .from('game_stats')
          .select('*, player:players(positions)')
          .eq('game_id', searchParams.game_id)
          .eq('team_id', t.id)

        if (gs) {
          let yds = 0, tds = 0, ints = 0, fumbles = 0, sacks = 0, pts = 0
          gs.forEach((s: any) => {
            const pos = s.player?.positions ?? []
            if (pos.includes('QB')) { yds += (s.pass_yards??0)+(s.qb_rush_yards??0); tds += (s.pass_tds??0)+(s.qb_rush_tds??0); ints += s.interceptions_thrown??0 }
            else if (pos.includes('RB')) { yds += (s.rush_yards??0)+(s.rb_rec_yards??0); tds += s.rush_tds??0; fumbles += s.rb_fumbles??0 }
            else if (pos.some((p: string) => ['WR','TE'].includes(p))) { yds += s.rec_yards??0; tds += s.rec_tds??0; fumbles += s.rec_fumbles??0 }
            else if (pos.some((p: string) => ['DL','LB','DB'].includes(p))) { sacks += Number(s.sacks??0) }
            else if (pos.some((p: string) => ['K','P'].includes(p))) { pts += (s.fg_made??0)*3+(s.ep_made??0) }
          })
          pts += tds * 6
          setTotals({ yds, tds, ints, fumbles, sacks, pts })
        }
      }
    }
    load()
    const channel = supabase.channel('team-stats-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [params.slug, searchParams.game_id])

  if (!team || !totals) return null

  const items = [
    { label: 'Total YDS', value: totals.yds },
    { label: 'TDs', value: totals.tds },
    { label: 'Points', value: totals.pts },
    { label: 'INTs', value: totals.ints },
    { label: 'Fumbles', value: totals.fumbles },
    { label: 'Sacks', value: totals.sacks },
  ]

  return (
    <div style={{ position: 'absolute', bottom: 80, left: 80 }}>
      <div style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
        <div style={{ background: team.primary_color, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'white', fontSize: 18, fontWeight: 900, fontFamily: 'Arial Black, sans-serif' }}>
            {team.name.toUpperCase()}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginLeft: 'auto' }}>TEAM STATS</span>
        </div>
        <div style={{ display: 'flex', padding: '12px 16px', gap: 28 }}>
          {items.map(item => (
            <div key={item.label} style={{ textAlign: 'center', minWidth: 56 }}>
              <div style={{ color: 'white', fontSize: 30, fontWeight: 900, fontFamily: 'Arial Black, sans-serif', lineHeight: 1 }}>
                {item.value}
              </div>
              <div style={{ color: '#7a7a7a', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
