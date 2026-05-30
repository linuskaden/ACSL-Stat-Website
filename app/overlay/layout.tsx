export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Force the browser body to be a clean 1920×1080 transparent canvas for vMix/OBS */}
      <style>{`
        html, body {
          width: 1920px !important;
          height: 1080px !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: transparent !important;
        }
      `}</style>
      <div style={{
        width: 1920,
        height: 1080,
        position: 'relative',
        overflow: 'hidden',
        background: 'transparent',
      }}>
        {children}
      </div>
    </>
  )
}
