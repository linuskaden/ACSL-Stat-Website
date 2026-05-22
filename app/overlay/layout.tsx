export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden', background: 'transparent' }}>
      {children}
    </div>
  )
}
