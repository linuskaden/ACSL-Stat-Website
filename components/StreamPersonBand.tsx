/* ───────────────────────────────────────────────
   Presentational crew/contributor lower-third — small,
   bottom-left, ACSL red with the ACSL wordmark. Shared by
   the overlay route and the admin preview. Parent owns
   visibility.
─────────────────────────────────────────────── */
export type StreamPerson = { name: string; role: string | null; logo_url?: string | null }

const ACSL_RED = '#ff1d25'

export default function StreamPersonBand({ person, visible }: { person: StreamPerson | null; visible: boolean }) {
  const active = visible && !!person
  const logoSrc = person?.logo_url ?? '/logos/ACSL-Logo.png'
  const isCustomLogo = !!person?.logo_url
  return (
    <div style={{
      position: 'absolute', bottom: 56, left: 72,
      transition: 'transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.3s ease',
      transform: active ? 'translateY(0)' : 'translateY(160%)',
      opacity: active ? 1 : 0,
      pointerEvents: 'none',
    }}>
      {person && (
        <div style={{ display: 'inline-flex', boxShadow: '0 20px 60px rgba(0,0,0,0.85), 0 4px 20px rgba(0,0,0,0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', background: ACSL_RED, height: 80 }}>
            {/* Logo block — ACSL default or custom team logo */}
            <div style={{ width: 92, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '0 12px' }}>
              <img src={logoSrc} alt="" style={{ width: 68, objectFit: 'contain', filter: isCustomLogo ? 'none' : 'brightness(0) invert(1)' }} />
            </div>
            {/* Name + role */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px', gap: 5 }}>
              <div style={{
                color: '#ffffff', fontSize: 26, fontWeight: 900,
                fontFamily: '"Arial Black", Impact, sans-serif', letterSpacing: 0.4,
                lineHeight: 1, whiteSpace: 'nowrap',
              }}>
                {person.name.toUpperCase()}
              </div>
              {person.role && (
                <div style={{
                  color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: 700,
                  letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap',
                }}>
                  {person.role}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
