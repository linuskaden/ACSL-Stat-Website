/* ───────────────────────────────────────────────
   Presentational stream image panel — a near-fullscreen
   16:9 image floating over the live picture (margin on all
   sides so it reads as an overlay). Shared by the overlay
   route and the admin preview. Parent owns visibility.
─────────────────────────────────────────────── */
export default function StreamImagePanel({ url, visible }: { url: string | null; visible: boolean }) {
  const active = visible && !!url
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.4s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)',
      opacity: active ? 1 : 0,
      transform: active ? 'scale(1)' : 'scale(1.03)',
      pointerEvents: 'none',
    }}>
      {url && (
        <div style={{
          width: 1760, height: 990,   /* 16:9, centred → ~80px / 45px margin */
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 30px 90px rgba(0,0,0,0.75)',
          border: '2px solid rgba(255,255,255,0.18)',
          background: '#000',
        }}>
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
    </div>
  )
}
