/* ───────────────────────────────────────────────
   Presentational full-screen starting-lineup panel —
   shared by /overlay/lineup-full and the admin operator
   preview. Shows ALL position groups of one unit stacked
   (backfield / receivers / o-line, or d-line / lb / secondary)
   on a full team-color panel. Parent owns visibility.
─────────────────────────────────────────────── */
import { buildLineupScreens, type LineupSide } from '@/lib/lineup'

export type LineupFullPlayer = {
  id: string
  first_name: string
  last_name: string
  jersey_number: string | null
  positions: string[]
}
export type LineupFullTeam = {
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

export default function LineupFullPanel({ team, side, players, visible }: {
  team: LineupFullTeam | null
  side: LineupSide
  players: LineupFullPlayer[]
  visible: boolean
}) {
  const screens = buildLineupScreens(side, players)
  const active = visible && team && screens.length > 0
  const primary = team?.primary_color ?? '#ff1d25'
  const ink = textOn(primary)
  const dim = ink === '#ffffff' ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.55)'
  const faint = ink === '#ffffff' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)'
  const chipBg = ink === '#ffffff' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.5)'

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.4s ease, transform 0.55s cubic-bezier(0.22,1,0.36,1)',
      opacity: active ? 1 : 0,
      transform: active ? 'scale(1)' : 'scale(1.04)',
      pointerEvents: 'none',
    }}>
      {team && screens.length > 0 && (
        <div style={{
          width: 1760, height: 980,
          background: primary, borderRadius: 18, overflow: 'hidden', position: 'relative',
          boxShadow: '0 30px 90px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* depth + watermark */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,255,255,0.14) 0%, transparent 60%)' }} />
          {team.logo_url && (
            <img src={team.logo_url} alt="" style={{
              position: 'absolute', right: -120, bottom: -120, width: 640, height: 640,
              objectFit: 'contain', opacity: 0.08, filter: 'grayscale(0.2)',
            }} />
          )}

          {/* Header */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 28, padding: '40px 60px 28px', position: 'relative', zIndex: 1 }}>
            {team.logo_url && (
              <div style={{ width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src={team.logo_url} alt="" style={{ width: 110, height: 110, objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))' }} />
              </div>
            )}
            <div>
              <div style={{ color: ink, fontSize: 58, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.5, lineHeight: 1, textTransform: 'uppercase' }}>
                {team.name}
              </div>
              <div style={{ color: dim, fontSize: 26, fontWeight: 800, letterSpacing: 8, textTransform: 'uppercase', marginTop: 10 }}>
                {side === 'offense' ? 'Starting Offense' : 'Starting Defense'}
              </div>
            </div>
          </div>

          {/* Group rows (stacked) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 60px 44px', position: 'relative', zIndex: 1 }}>
            {screens.map((screen, gi) => (
              <div key={screen.group.key} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 28,
                borderTop: gi > 0 ? `1px solid ${faint}` : 'none',
              }}>
                {/* group label */}
                <div style={{ width: 200, flexShrink: 0 }}>
                  <div style={{ color: ink, fontSize: 24, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1.05 }}>
                    {screen.group.label}
                  </div>
                </div>
                {/* players */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  {screen.players.map((p, i) => (
                    <div key={p.id} style={{ flex: 1, minWidth: 0, padding: '0 18px', textAlign: 'center', borderLeft: i > 0 ? `1px solid ${faint}` : 'none' }}>
                      <span style={{
                        display: 'inline-block', background: chipBg, color: ink,
                        fontSize: 16, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif',
                        letterSpacing: 0.5, padding: '3px 11px', borderRadius: 3, marginBottom: 10, whiteSpace: 'nowrap',
                      }}>
                        {(p.positions[0] ?? '').toUpperCase()}{p.jersey_number != null ? ` ${p.jersey_number}` : ''}
                      </span>
                      <div style={{ color: dim, fontSize: 21, fontWeight: 800, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.4, textTransform: 'uppercase', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.first_name}
                      </div>
                      <div style={{ color: ink, fontSize: 31, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.2, textTransform: 'uppercase', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.last_name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
