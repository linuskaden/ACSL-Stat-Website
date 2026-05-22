'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calcYPA, calcYPC, calcYPR, calcCompPct } from '@/lib/utils'

const QUARTERS = ['Q1','Q2','Q3','Q4','OT']

export default function PlayerStatsOverlay({ params, searchParams }: {
  params: { id: string }
  searchParams: { mode?: 'live' | 'career'; game_id?: string; stats?: string }
}) {
  const [player, setPlayer] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    const mode = searchParams.mode ?? 'live'
    const customStats = searchParams.stats?.split(',') ?? []

    async function load() {
      const { data: p } = await supabase.from('players').select('*, team:teams(*)').eq('id', params.id).single()
      setPlayer(p)

      if (mode === 'career') {
        const { data: cs } = await supabase.from('career_stats').select('*').eq('player_id', params.id).eq('season', 2026).single()
        setStats(cs)
      } else if (searchParams.game_id) {
        const { data: gs } = await supabase.from('game_stats').select('*').eq('game_id', searchParams.game_id).eq('player_id', params.id)
        if (gs) {
          const totals: Record<string,number> = {}
          gs.forEach(s => { QUARTERS.forEach(() => {}); Object.entries(s).forEach(([k,v]) => { if (typeof v === 'number') totals[k] = (totals[k]??0)+v }) })
          setStats(totals)
        }
      }
    }

    load()

    const channel = supabase.channel('player-stats-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats', filter: `player_id=eq.${params.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [params.id, searchParams.game_id, searchParams.mode])

  if (!player || !stats) return null

  const pos = player.positions ?? []
  const team = player.team

  const statItems = buildStatItems(pos, stats)

  return (
    <div style={{ position: 'absolute', bottom: 80, left: 80 }}>
      <div style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)', borderRadius: 8, overflow: 'hidden', minWidth: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ background: team?.primary_color, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'white', fontSize: 20, fontWeight: 900, fontFamily: 'Arial Black, sans-serif' }}>
            #{player.jersey_number} {player.first_name.toUpperCase()} {player.last_name.toUpperCase()}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, marginLeft: 'auto' }}>
            {searchParams.mode === 'career' ? `${2026} SEASON` : 'GAME STATS'}
          </span>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'flex', padding: '12px 16px', gap: 24 }}>
          {statItems.map((item: any) => (
            <div key={item.label} style={{ textAlign: 'center', minWidth: 60 }}>
              <div style={{ color: 'white', fontSize: 28, fontWeight: 900, fontFamily: 'Arial Black, sans-serif', lineHeight: 1 }}>
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

function buildStatItems(pos: string[], s: any) {
  if (!s) return []
  if (pos.includes('QB')) return [
    { label: 'Pass YDS', value: s.pass_yards ?? 0 },
    { label: 'TD', value: (s.pass_tds??0)+(s.qb_rush_tds??0) },
    { label: 'INT', value: s.interceptions_thrown ?? 0 },
    { label: 'Comp/Att', value: `${s.pass_completions??0}/${s.pass_attempts??0}` },
    { label: 'YPA', value: calcYPA(s.pass_yards??0, s.pass_attempts??0) },
    { label: 'Rush YDS', value: s.qb_rush_yards ?? 0 },
  ]
  if (pos.includes('RB')) return [
    { label: 'Rush YDS', value: s.rush_yards ?? 0 },
    { label: 'TD', value: s.rush_tds ?? 0 },
    { label: 'Carries', value: s.rush_carries ?? 0 },
    { label: 'YPC', value: calcYPC(s.rush_yards??0, s.rush_carries??0) },
    { label: 'Rec YDS', value: s.rb_rec_yards ?? 0 },
    { label: 'Rec', value: s.rb_receptions ?? 0 },
  ]
  if (pos.some((p: string) => ['WR','TE'].includes(p))) return [
    { label: 'Rec YDS', value: s.rec_yards ?? 0 },
    { label: 'TD', value: s.rec_tds ?? 0 },
    { label: 'Rec', value: s.receptions ?? 0 },
    { label: 'Tar', value: s.rec_targets ?? 0 },
    { label: 'YPR', value: calcYPR(s.rec_yards??0, s.receptions??0) },
  ]
  if (pos.some((p: string) => ['K','P'].includes(p))) return [
    { label: 'FG', value: `${s.fg_made??0}/${s.fg_attempts??0}` },
    { label: 'EP', value: `${s.ep_made??0}/${s.ep_attempts??0}` },
    { label: 'Points', value: (s.fg_made??0)*3+(s.ep_made??0) },
  ]
  return [
    { label: 'Sacks', value: s.sacks ?? 0 },
    { label: 'INT', value: s.def_interceptions ?? 0 },
  ]
}
