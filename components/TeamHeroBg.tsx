'use client'
import { useEffect, useState } from 'react'

/* Team hero background: crossfading photos when available, otherwise a
   team-colour gradient. A dark scrim keeps overlaid text legible. Overlay
   content (logo, name, record) is passed as children. */
export default function TeamHeroBg({
  images,
  primary,
  secondary,
  intervalMs = 5000,
  children,
}: {
  images: string[]
  primary: string
  secondary: string
  intervalMs?: number
  children?: React.ReactNode
}) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (images.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % images.length), intervalMs)
    return () => clearInterval(t)
  }, [images.length, intervalMs])

  const gradient = `linear-gradient(135deg, ${primary} 0%, ${secondary || primary} 100%)`

  return (
    <section className="relative w-full overflow-hidden" style={{ minHeight: 'clamp(340px, 52vh, 560px)' }}>
      {/* Background: gradient base always present (also the image fallback) */}
      <div className="absolute inset-0" style={{ background: gradient }} />

      {/* Crossfading photos */}
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover transition-opacity ease-in-out"
          style={{ opacity: i === idx ? 1 : 0, transitionDuration: '1500ms' }}
        />
      ))}

      {/* Scrim: darken top slightly and bottom strongly for the overlaid identity */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.82) 100%)' }}
      />

      {/* Overlay content */}
      <div className="relative z-10">{children}</div>

      {/* Progress dots */}
      {images.length > 1 && (
        <div className="absolute bottom-4 right-5 z-10 flex gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all"
              style={{ width: i === idx ? 20 : 7, height: 7, background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)' }}
            />
          ))}
        </div>
      )}
    </section>
  )
}
