'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Category = 'passing' | 'rushing' | 'receiving' | 'defense' | 'kicking'

const CATEGORY_LABELS: Record<string, string> = {
  passing: 'PASSING LEADERS',
  rushing: 'RUSHING LEADERS',
  receiving: 'RECEIVING LEADERS',
  defense: 'DEFENSIVE LEADERS',
  kicking: 'KICKING LEADERS',
}

export default function LeadersOverlay({ params, searchParams }: {
  params: { category: Category }; searchParams: { game_id?: string; limit?: string }
}) {
  const [leaders, setLeaders] = useState<any[]>([])

  useEffect(() => {
    const supabase = createClient()
    const limit = Number(searchParams.limit ?? 5)
    const cat = params.category as Category

    async function load() {
      if (!searchParams.game_id) return

      const { data: gs } = await supabase
        .from('game_stats')
        .select('*, player:players(*, team:teams(*))')
        .eq('game_id', searchParams.game_id)

      if (!gs) return

      const byPlayer: Record<string, any> = {}
      gs.forEach((s: any) => {
        const pid = s.player_id
        if (!byPlayer[pid]) byPlayer[pid] = { ...s, player: s.player }
        else {
          const keys = ['pass_yards','pass_tds','pass_attempts','pass_completions','interceptions_thrown',
            'qb_rush_yards','qb_rush_tds','rush_yards','rush_carries','rush_tds','rb_rec_yards','rb_receptions',
            'rec_yards','receptions','rec_tds','sacks','def_interceptions','fg_made','fg_attempts','ep_made','ep_attempts']
          keys.forEach(k => { byPlayer[pid][k] = (byPlayer[pid][k]??0) + (s[k]??0) })
        }
      })

      const all = Object.values(byPlayer)
      let sorted: any[] = []

      if (cat === 'passing') sorted = all.filter(s => s.pass_yards > 0).sort((a,b) => b.pass_yards - a.pass_yards)
      else if (cat === 'rushing') sorted = all.filter(s => s.rush_yards > 0 || s.qb_rush_yards > 0).sort((a,b) => (b.rush_yards+b.qb_rush_yards) - (a.rush_yards+a.qb_rush_yards))
      else if (cat === 'receiving') sorted = all.filter(s => s.rec_yards > 0 || s.rb_rec_yards > 0).sort((a,b) => (b.rec_yards+b.rb_rec_yards) - (a.rec_yards+a.rb_rec_yards))
      else if (cat === 'defense') sorted = all.filter(s => s.sacks > 0 || s.def_interceptions > 0).sort((a,b) => (b.sacks+b.def_interceptions*2) - (a.sacks+a.def_interceptions*2))
      else if (cat === 'kicking') sorted = all.filter(s => s.fg_attempts > 0 || s.ep_attempts > 0).sort((a,b) => (b.fg_made*3+b.ep_made) - (a.fg_made*3+a.ep_made))

      setLeaders(sorted.slice(0, limit))
    }

    load()
    const channel = supabase.channel('leaders-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_stats' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [params.category, searchParams.game_id])

  if (!leaders.length) return null

  return (
    <div style={{ position: 'absolute', bottom: 80, left: 80 }}>
      <div style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 380 }}>
        <div style={{ background: '#ff1d25', padding: '8px 16px' }}>
          <span style={{ color: 'white', fontSize: 14, fontWeight: 900, fontFamily: 'Arial Black, sans-serif', letterSpacing: 2 }}>
            {CATEGORY_LABELS[params.category] ?? params.category.toUpperCase()}
          </span>
        </div>
        <div style={{ padding: '8px 0' }}>
          {leaders.map((s: any, i) => {
            const p = s.player
            const team = p?.team
            const cat = params.category as Category
            const val = cat === 'passing' ? `${s.pass_yards} YDS · ${s.pass_tds} TD`
              : cat === 'rushing' ? `${s.rush_yards + s.qb_rush_yards} YDS · ${s.rush_tds + s.qb_rush_tds} TD`
              : cat === 'receiving' ? `${s.rec_yards + s.rb_rec_yards} YDS · ${s.rec_tds} TD`
              : cat === 'defense' ? `${s.sacks} SCK · ${s.def_interceptions} INT`
              : `${s.fg_made}/${s.fg_attempts} FG · ${s.eg_made}/${s.ep_attempts} EP`

            return (
              <div key={s.player_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px', borderBottom: i < leaders.length-1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span style={{ color: '#7a7a7a', fontSize: 13, fontWeight: 700, width: 20, textAlign: 'center' }}>{i+1}</span>
                <div style={{ width: 4, height: 32, borderRadius: 2, background: team?.primary_color ?? '#ff1d25', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontSize: 14, fontWeight: 800, fontFamily: 'Arial Black, sans-serif' }}>
                    {p?.first_name?.[0]}. {p?.last_name} <span style={{ color: '#7a7a7a', fontSize: 11, fontWeight: 400 }}>#{p?.jersey_number}</span>
                  </div>
                  <div style={{ color: '#7a7a7a', fontSize: 11 }}>{team?.short_name} · {p?.positions?.[0]}</div>
                </div>
                <div style={{ color: 'white', fontSize: 14, fontWeight: 700, textAlign: 'right' }}>{val}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
