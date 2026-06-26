/* ───────────────────────────────────────────────
   Presentational starting-lineup band — shared by the
   real overlay (/overlay/lineup) and the admin operator
   preview so the look lives in ONE place.
   Renders a bottom band at true 1920×1080 coordinates;
   the parent owns rotation (idx/shown) + visibility.
─────────────────────────────────────────────── */
import type { LineupSide, LineupScreen } from '@/lib/lineup'

export type LineupBandPlayer = {
  id: string
  first_name: string
  last_name: string
  jersey_number: string | null
  positions: string[]
}
export type LineupBandTeam = {
  short_name: string
  name: string
  primary_color: string
  logo_url: string | null
}

function lum(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}
function textOn(hex: string): string { return lum(hex) > 0.48 ? '#000000' : '#ffffff' }

export default function LineupBand({ team, side, screens, idx, shown, visible }: {
  team: LineupBandTeam | null
  side: LineupSide
  screens: LineupScreen<LineupBandPlayer>[]
  idx: number
  shown: boolean
  visible: boolean
}) {
  const current = screens[idx] ?? null
  const active = visible && team && current
  const primary = team?.primary_color ?? '#ff1d25'
  const onPrimary = textOn(primary)

  return (
    <div style={{
      position: 'absolute',
      left: 500,
      bottom: 140,
      transition: 'transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease',
      transform: active ? 'translateY(0)' : 'translateY(140%)',
      opacity: active ? 1 : 0,
      pointerEvents: 'none',
    }}>
      {team && current && (
        <div style={{
          width: 1720,
          transform: 'scale(0.5827)',
          transformOrigin: 'bottom left',
          display: 'flex', alignItems: 'stretch',
          background: 'linear-gradient(to top, rgba(6,8,15,0.97) 0%, rgba(10,13,26,0.9) 100%)',
          borderTop: `4px solid ${primary}`,
          overflow: 'hidden',
        }}>
          {/* Team logo block */}
          <div style={{
            width: 240, flexShrink: 0, background: primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 70% at 50% 45%, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
            {team.logo_url
              ? <img src={team.logo_url} alt="" style={{ width: 150, height: 150, objectFit: 'contain', position: 'relative', zIndex: 1, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }} />
              : <span style={{ color: onPrimary, fontSize: 56, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', position: 'relative', zIndex: 1 }}>{team.short_name.slice(0, 3).toUpperCase()}</span>}
          </div>

          {/* Body: group label + player row */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '20px 40px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <span style={{
                background: '#2b2f3a', color: '#fff',
                fontSize: 24, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif',
                letterSpacing: 3, textTransform: 'uppercase', padding: '7px 20px', borderRadius: 4,
              }}>
                {current.group.label}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 16, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase' }}>
                {side === 'offense' ? 'Starting Offense' : 'Starting Defense'}
              </span>
              {screens.length > 1 && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
                  {screens.map((_, i) => (
                    <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: i === idx ? primary : 'rgba(255,255,255,0.22)', transition: 'background 0.3s' }} />
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', flex: 1, transition: 'opacity 0.36s ease', opacity: shown ? 1 : 0 }}>
              {current.players.map((p, i) => (
                <div key={p.id} style={{ flex: 1, minWidth: 0, padding: '0 22px', textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}>
                  <span style={{
                    display: 'inline-block', background: primary, color: onPrimary,
                    fontSize: 17, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif',
                    letterSpacing: 1, padding: '4px 12px', borderRadius: 3, marginBottom: 12, whiteSpace: 'nowrap',
                  }}>
                    {(p.positions[0] ?? '').toUpperCase()}{p.jersey_number != null ? ` ${p.jersey_number}` : ''}
                  </span>
                  <div style={{
                    color: 'rgba(255,255,255,0.78)', fontSize: 22, fontWeight: 800,
                    fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.5,
                    textTransform: 'uppercase', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                  }}>
                    {p.first_name}
                  </div>
                  <div style={{
                    color: '#fff', fontSize: 34, fontWeight: 900,
                    fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.3,
                    textTransform: 'uppercase', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    textShadow: '0 2px 10px rgba(0,0,0,0.9)',
                  }}>
                    {p.last_name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
