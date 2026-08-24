'use client'
import { useEffect, useState } from 'react'

/* Full-bleed background slideshow with a crossfade, plus a dark scrim and an
   overlay (the title) rendered on top via children. */
export default function HeroSlideshow({
  images,
  intervalMs = 5000,
  children,
}: {
  images: string[]
  intervalMs?: number
  children?: React.ReactNode
}) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (images.length <= 1) return
    const t = setInterval(() => setIdx(i => (i + 1) % images.length), intervalMs)
    return () => clearInterval(t)
  }, [images.length, intervalMs])

  return (
    <section className="relative w-full overflow-hidden" style={{ height: 'min(88vh, 900px)' }}>
      {/* Images */}
      {images.length > 0 ? (
        images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover transition-opacity ease-in-out"
            style={{ opacity: i === idx ? 1 : 0, transitionDuration: '1500ms' }}
          />
        ))
      ) : (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #17171c 0%, #000 100%)' }} />
      )}

      {/* Dark scrim for legibility */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.65) 100%)' }}
      />

      {/* Overlay content (title) */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
        {children}
      </div>

      {/* Progress dots */}
      {images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {images.map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all"
              style={{
                width: i === idx ? 22 : 8,
                height: 8,
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}
