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

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, isNaN(n) ? lo : n))

function LayoutField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{value}%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="range" min={0} max={100} value={value} onChange={e => onChange(clamp(Number(e.target.value), 0, 100))} style={{ flex: 1, accentColor: '#ff1d25' }} />
        <input type="number" min={0} max={100} value={value} onChange={e => onChange(clamp(Number(e.target.value), 0, 100))}
          style={{ width: 58, background: '#131826', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 6px', color: '#fff', fontSize: 12, outline: 'none' }} />
      </div>
    </div>
  )
}

type Layout = { x: number; y: number; w: number; h: number } // all in % of the stage

const PRESETS: { label: string; layout: Layout }[] = [
  { label: 'Vollbild',     layout: { x: 0,  y: 0,  w: 100, h: 100 } },
  { label: 'Unten Mitte',  layout: { x: 30, y: 62, w: 40,  h: 34 } },
  { label: 'Oben Mitte',   layout: { x: 30, y: 4,  w: 40,  h: 34 } },
  { label: 'Unten Links',  layout: { x: 3,  y: 60, w: 34,  h: 36 } },
  { label: 'Unten Rechts', layout: { x: 63, y: 60, w: 34,  h: 36 } },
]

export default function BroadcastMonitor() {
  const [input, setInput]         = useState('')
  const [bgUrl, setBgUrl]         = useState('')
  const [bgVisible, setBgVisible] = useState(true)
  const [layout, setLayout]       = useState<Layout>({ x: 0, y: 0, w: 100, h: 100 })
  const [editorOpen, setEditorOpen] = useState(false)
  const [scale, setScale]         = useState(0.5)
  const stageRef = useRef<HTMLDivElement>(null)
  const isFull = layout.x === 0 && layout.y === 0 && layout.w === 100 && layout.h === 100

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
          <button onClick={() => setEditorOpen(true)} disabled={!bgUrl}
            className="px-4 py-2 text-sm font-bold rounded-lg border border-black/10 dark:border-white/15 text-slate-700 dark:text-[#ccc] disabled:opacity-40 transition">
            ⚙ Größe &amp; Position
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
        {/* Background web input — positioned/sized like a vMix input */}
        {bgUrl && bgVisible ? (
          <iframe
            src={bgUrl}
            title="Web input"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            style={{
              position: 'absolute',
              left: `${layout.x}%`, top: `${layout.y}%`,
              width: `${layout.w}%`, height: `${layout.h}%`,
              border: 0,
              borderRadius: isFull ? 0 : 6,
              boxShadow: isFull ? 'none' : '0 6px 24px rgba(0,0,0,0.6)',
              background: '#000',
            }}
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

      {/* Floating size & position editor — monitor stays visible for live preview */}
      {editorOpen && (
        <div style={{
          position: 'fixed', top: 84, right: 24, width: 340, zIndex: 70,
          background: '#0c0f1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
          boxShadow: '0 24px 70px rgba(0,0,0,0.65)', color: '#fff',
          fontFamily: 'system-ui, sans-serif',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: 13, fontWeight: 900 }}>Web-Input · Größe &amp; Position</span>
            <button onClick={() => setEditorOpen(false)} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, width: 26, height: 26, color: '#aaa', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>

          <div style={{ padding: 14 }}>
            {/* Presets */}
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', textTransform: 'uppercase', marginBottom: 6 }}>Presets</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {PRESETS.map(p => {
                const active = layout.x === p.layout.x && layout.y === p.layout.y && layout.w === p.layout.w && layout.h === p.layout.h
                return (
                  <button key={p.label} onClick={() => setLayout(p.layout)}
                    style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, borderRadius: 7, cursor: 'pointer',
                      background: active ? '#ff1d25' : '#131826', color: active ? '#fff' : '#999',
                      border: `1px solid ${active ? '#ff1d25' : 'rgba(255,255,255,0.1)'}` }}>
                    {p.label}
                  </button>
                )
              })}
            </div>

            {/* Sliders */}
            <LayoutField label="Position X" value={layout.x} onChange={v => setLayout(l => ({ ...l, x: v }))} />
            <LayoutField label="Position Y" value={layout.y} onChange={v => setLayout(l => ({ ...l, y: v }))} />
            <LayoutField label="Breite"     value={layout.w} onChange={v => setLayout(l => ({ ...l, w: v }))} />
            <LayoutField label="Höhe"       value={layout.h} onChange={v => setLayout(l => ({ ...l, h: v }))} />

            <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
              Werte in % des 16:9-Fensters. Änderungen erscheinen sofort im Monitor.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
