'use client'
import { useEffect, useRef, useState } from 'react'
import LowerThirdOverlay from '@/app/overlay/lower-third/page'
import TeamStatsOverlay from '@/app/overlay/team-stats/page'
import KeyPlayersOverlay from '@/app/overlay/key-players/page'

/* Turn a pasted URL into something embeddable where we can (YouTube / Twitch),
   otherwise pass it through and let the browser decide. */
function toEmbeddable(raw: string): string {
  let u = raw.trim()
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try {
    const url = new URL(u)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtube.com' && url.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${url.searchParams.get('v')}?autoplay=1&mute=1`
    }
    if (host === 'youtu.be') {
      return `https://www.youtube.com/embed/${url.pathname.slice(1)}?autoplay=1&mute=1`
    }
    if (host === 'twitch.tv') {
      const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
      return `https://player.twitch.tv/?channel=${url.pathname.slice(1)}&parent=${parent}&autoplay=true&muted=true`
    }
  } catch { /* not a valid URL — leave as typed */ }
  return u
}

export default function BroadcastMonitor() {
  const [input, setInput]         = useState('')
  const [bgUrl, setBgUrl]         = useState('')
  const [bgVisible, setBgVisible] = useState(true)
  const [scale, setScale]         = useState(0.5)
  const stageRef = useRef<HTMLDivElement>(null)

  // Keep the 1920×1080 stage scaled to whatever width the monitor has
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setScale(el.clientWidth / 1920)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  function load() {
    setBgUrl(toEmbeddable(input))
    setBgVisible(true)
  }
  function clear() {
    setInput('')
    setBgUrl('')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">ACSL Broadcast</h1>
        <p className="text-sm text-slate-500 dark:text-[#7a7a7a] mt-1">
          Live-Programm-Monitor — die ACSL-Overlays über einem frei wählbaren Web-Input, wie ein vMix-Output.
        </p>
      </div>

      {/* Web input controls */}
      <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#111] p-4 mb-5">
        <div className="text-[11px] font-bold tracking-widest uppercase text-slate-400 dark:text-[#555] mb-2">
          Web-Input · Hintergrund
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') load() }}
            placeholder="https://…  (z. B. YouTube-/Twitch-Stream oder beliebige Website)"
            className="flex-1 min-w-[260px] bg-slate-50 dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-[#555] outline-none"
          />
          <button onClick={load}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-[#ff1d25] text-white hover:opacity-90 transition">
            Laden
          </button>
          <button onClick={() => setBgVisible(v => !v)} disabled={!bgUrl}
            className="px-4 py-2 text-sm font-bold rounded-lg border border-black/10 dark:border-white/15 text-slate-700 dark:text-[#ccc] disabled:opacity-40 transition"
            style={{ background: bgVisible && bgUrl ? 'rgba(4,165,80,0.12)' : 'transparent', color: bgVisible && bgUrl ? '#04a550' : undefined }}>
            {bgVisible ? '▼ Hintergrund aus' : '▲ Hintergrund an'}
          </button>
          <button onClick={clear} disabled={!bgUrl && !input}
            className="px-4 py-2 text-sm font-bold rounded-lg border border-black/10 dark:border-white/15 text-slate-500 dark:text-[#888] disabled:opacity-40 transition">
            Leeren
          </button>
        </div>
        <p className="text-[11px] text-slate-400 dark:text-[#666] mt-2">
          Hinweis: Manche Seiten verbieten das Einbetten (X-Frame-Options/CSP) und bleiben dann leer — das ist eine Browser-Sicherheitssperre, die sich nicht umgehen lässt. YouTube- &amp; Twitch-Links werden automatisch in einbettbare Player umgewandelt.
        </p>
      </div>

      {/* 16:9 program monitor */}
      <div
        ref={stageRef}
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          position: 'relative',
          overflow: 'hidden',
          background: '#06080f',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        }}
      >
        {/* Background web input */}
        {bgUrl && bgVisible ? (
          <iframe
            src={bgUrl}
            title="Web input"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.18)', fontSize: 13, fontWeight: 600, letterSpacing: 1 }}>
            Kein Web-Input — nur Overlays
          </div>
        )}

        {/* Live ACSL overlays at real 1920×1080, scaled to fit. pointer-events:none so the iframe stays interactive */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: 1920, height: 1080,
          transform: `scale(${scale})`, transformOrigin: 'top left',
          pointerEvents: 'none',
        }}>
          <TeamStatsOverlay />
          <LowerThirdOverlay />
          <KeyPlayersOverlay />
        </div>

        {/* LIVE marker */}
        <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff1d25', boxShadow: '0 0 8px #ff1d25' }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>LIVE PREVIEW</span>
        </div>
      </div>

      <p className="text-xs text-slate-400 dark:text-[#666] mt-3">
        Die Overlays werden live aus dem vMix-Overlay-Control gesteuert (Spieler-Karte, Team-Stats, Key-Player-Ticker) und erscheinen hier sofort.
      </p>
    </div>
  )
}
