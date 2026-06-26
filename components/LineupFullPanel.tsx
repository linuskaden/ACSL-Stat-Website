/* ───────────────────────────────────────────────
   Presentational full-screen starting-lineup panel —
   shared by /overlay/lineup-full and the admin operator
   preview. Shows ALL position groups of one unit stacked
   (backfield / receivers / o-line, or d-line / lb / secondary).
   Look: ~90%-opaque dark-grey panel, thick team-color header
   stripe, faint team-logo watermark, team-color position pills.
   Parent owns visibility.
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

/* text colors on the dark-grey body (always light) */
const INK = '#ffffff'
const DIM = 'rgba(255,255,255,0.66)'
const FAINT = 'rgba(255,255,255,0.12)'

export default function LineupFullPanel({ team, side, players, visible }: {
  team: LineupFullTeam | null
  side: LineupSide
  players: LineupFullPlayer[]
  visible: boolean
}) {
  const screens = buildLineupScreens(side, players)
  const active = visible && team && screens.length > 0
  const primary = team?.primary_color ?? '#ff1d25'
  const stripeInk = textOn(primary)
  const stripeDim = stripeInk === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 100,
      transition: 'opacity 0.4s ease, transform 0.55s cubic-bezier(0.22,1,0.36,1)',
      opacity: active ? 1 : 0,
      transform: active ? 'scale(1)' : 'scale(1.04)',
      pointerEvents: 'none',
    }}>
      {team && screens.length > 0 && (
        <div style={{
          width: 1760, height: 980,
          transform: 'scale(0.7)', transformOrigin: 'top center',
          background: 'rgba(18,20,26,0.92)', borderRadius: 18, overflow: 'hidden', position: 'relative',
          boxShadow: '0 30px 90px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          {/* faint team-logo watermark */}
          {team.logo_url && (
            <img src={team.logo_url} alt="" style={{
              position: 'absolute', right: -110, bottom: -130, width: 620, height: 620,
              objectFit: 'contain', opacity: 0.07,
            }} />
          )}

          {/* Thick team-color header stripe */}
          <div style={{
            flexShrink: 0, height: 150, background: primary,
            display: 'flex', alignItems: 'center', gap: 28, padding: '0 56px',
            position: 'relative', zIndex: 1,
            boxShadow: '0 6px 22px rgba(0,0,0,0.35)',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 120% at 0% 50%, rgba(255,255,255,0.14) 0%, transparent 60%)' }} />
            {team.logo_url && (
              <img src={team.logo_url} alt="" style={{ width: 104, height: 104, objectFit: 'contain', flexShrink: 0, position: 'relative', zIndex: 1, filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.4))' }} />
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ color: stripeInk, fontSize: 52, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.5, lineHeight: 1, textTransform: 'uppercase' }}>
                {team.name}
              </div>
              <div style={{ color: stripeDim, fontSize: 23, fontWeight: 800, letterSpacing: 8, textTransform: 'uppercase', marginTop: 9 }}>
                {side === 'offense' ? 'Starting Offense' : 'Starting Defense'}
              </div>
            </div>
          </div>

          {/* Group rows (stacked) on the grey body */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 56px 40px', position: 'relative', zIndex: 1 }}>
            {screens.map((screen, gi) => (
              <div key={screen.group.key} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 28,
                borderTop: gi > 0 ? `1px solid ${FAINT}` : 'none',
              }}>
                {/* group label + team-color tick */}
                <div style={{ width: 210, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 5, height: 34, background: primary, borderRadius: 3, flexShrink: 0 }} />
                  <div style={{ color: INK, fontSize: 23, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1.05 }}>
                    {screen.group.label}
                  </div>
                </div>
                {/* players */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
                  {screen.players.map((p, i) => (
                    <div key={p.id} style={{ flex: 1, minWidth: 0, padding: '0 18px', textAlign: 'center', borderLeft: i > 0 ? `1px solid ${FAINT}` : 'none' }}>
                      <span style={{
                        display: 'inline-block', background: primary, color: textOn(primary),
                        fontSize: 16, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif',
                        letterSpacing: 0.5, padding: '3px 11px', borderRadius: 3, marginBottom: 10, whiteSpace: 'nowrap',
                      }}>
                        {(p.positions[0] ?? '').toUpperCase()}{p.jersey_number != null ? ` ${p.jersey_number}` : ''}
                      </span>
                      <div style={{ color: DIM, fontSize: 21, fontWeight: 800, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.4, textTransform: 'uppercase', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.first_name}
                      </div>
                      <div style={{ color: INK, fontSize: 31, fontWeight: 900, fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.2, textTransform: 'uppercase', lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
