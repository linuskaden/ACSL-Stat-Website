'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PlayerWithTeam } from '@/lib/supabase/types'

export default function PlayerOverlay({ params, searchParams }: { params: { id: string }; searchParams: { animate?: string } }) {
  const [player, setPlayer] = useState<PlayerWithTeam | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('players').select('*, team:teams(*)').eq('id', params.id).single()
      .then(({ data }) => setPlayer(data as PlayerWithTeam))

    const channel = supabase.channel('player-overlay')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `id=eq.${params.id}` },
        ({ new: data }) => setPlayer(prev => ({ ...prev!, ...data }))
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [params.id])

  if (!player) return null
  const team = player.team

  return (
    <div style={{ position: 'absolute', bottom: 80, left: 80 }}>
      {/* Lower-third player card */}
      <div style={{
        display: 'flex', alignItems: 'stretch', borderRadius: 8, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)', animation: 'slideIn 0.4s ease-out',
        minWidth: 520,
      }}>
        {/* Color bar */}
        <div style={{ width: 8, background: team?.primary_color ?? '#ff1d25' }} />

        {/* Number */}
        <div style={{
          background: team?.primary_color ?? '#ff1d25', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '12px 20px', minWidth: 80,
        }}>
          <span style={{ fontSize: 48, fontWeight: 900, fontFamily: 'Arial Black, sans-serif', lineHeight: 1 }}>
            {player.jersey_number ?? '#'}
          </span>
        </div>

        {/* Info */}
        <div style={{ background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)', padding: '12px 20px', flex: 1 }}>
          <div style={{ color: '#7a7a7a', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
            {player.positions.join(' / ')} · {team?.university ?? ''}
          </div>
          <div style={{ color: 'white', fontSize: 28, fontWeight: 900, fontFamily: 'Arial Black, sans-serif', lineHeight: 1, letterSpacing: -0.5 }}>
            {player.first_name.toUpperCase()} {player.last_name.toUpperCase()}
          </div>
          {player.field_of_study && (
            <div style={{ color: '#7a7a7a', fontSize: 12, marginTop: 4 }}>
              {player.field_of_study}{player.hometown ? ` · ${player.hometown}` : ''}
            </div>
          )}
        </div>

        {/* Team name tag */}
        <div style={{
          background: team?.secondary_color ?? '#000',
          display: 'flex', alignItems: 'center', padding: '0 16px',
        }}>
          <span style={{ color: 'white', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>
            {team?.short_name ?? ''}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
