'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type StreamOverlayState = {
  mode: 'image' | 'person'
  image_path: string | null
  person_id: string | null
  visible: boolean
}
type StreamImage = { id: string; path: string; label: string | null; signedUrl: string | null }
type StreamPersonRow = { id: string; name: string; role: string | null; logo_url?: string | null }

const BUCKET = 'stream-images'

export default function StreamControls() {
  const [stream, setStream] = useState<StreamOverlayState>({ mode: 'image', image_path: null, person_id: null, visible: false })
  const [images, setImages] = useState<StreamImage[]>([])
  const [people, setPeople] = useState<StreamPersonRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [personSearch, setPersonSearch] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadImages() {
    const supabase = createClient()
    const { data } = await supabase.from('stream_images').select('id, path, label').order('sort_order', { ascending: true })
    const rows = (data as { id: string; path: string; label: string | null }[]) ?? []
    const signed = rows.map(r => ({
      ...r,
      signedUrl: supabase.storage.from(BUCKET).getPublicUrl(r.path).data.publicUrl,
    })) as StreamImage[]
    setImages(signed)
  }

  useEffect(() => {
    const supabase = createClient()
    async function init() {
      const [{ data: st }, { data: ppl }] = await Promise.all([
        supabase.from('stream_overlay_state').select('*').eq('id', 1).single(),
        supabase.from('stream_people').select('id, name, role, logo_url').order('sort_order', { ascending: true }),
      ])
      if (st) setStream(st as StreamOverlayState)
      if (ppl) setPeople(ppl as StreamPersonRow[])
      await loadImages()
    }
    init()
    const ch = supabase.channel('admin-stream-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stream_overlay_state' },
        ({ new: row }) => setStream(row as StreamOverlayState))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function pushStream(patch: Partial<StreamOverlayState>) {
    const supabase = createClient()
    // Mutually exclusive with the game overlays
    if (patch.visible === true) {
      const now = new Date().toISOString()
      await Promise.all([
        supabase.from('overlay_state').update({ visible: false, updated_at: now }).eq('id', 1),
        supabase.from('team_overlay_state').update({ visible: false, updated_at: now }).eq('id', 1),
        supabase.from('lineup_overlay_state').update({ visible: false, updated_at: now }).eq('id', 1),
        supabase.from('key_player_overlay_state').update({ visible: false, updated_at: now }).eq('id', 1),
      ])
    }
    setStream(prev => ({ ...prev, ...patch }))
    await supabase.from('stream_overlay_state').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
  }

  const imageOnAir = (path: string) => stream.visible && stream.mode === 'image' && stream.image_path === path
  const personOnAir = (id: string) => stream.visible && stream.mode === 'person' && stream.person_id === id

  function showImage(path: string) {
    if (imageOnAir(path)) pushStream({ visible: false })
    else pushStream({ mode: 'image', image_path: path, visible: true })
  }
  function showPerson(id: string) {
    if (personOnAir(id)) pushStream({ visible: false })
    else pushStream({ mode: 'person', person_id: id, visible: true })
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const supabase = createClient()
    for (const file of Array.from(files)) {
      const key = `uploads/${Date.now()}_${file.name.normalize('NFKD').replace(/[^\w.\-]/g, '_')}`
      const { error } = await supabase.storage.from(BUCKET).upload(key, file, { upsert: true, contentType: file.type })
      if (error) { console.error('upload failed', file.name, error.message); continue }
      await supabase.from('stream_images').insert({ path: key, label: file.name.replace(/\.[^.]+$/, ''), sort_order: Date.now() % 1000000 })
    }
    await loadImages()
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      {/* ── Image gallery ── */}
      <div style={{ background: '#080b14', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#444', textTransform: 'uppercase' }}>Bild-Einblendung</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)', minWidth: 20 }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: uploading ? 'wait' : 'pointer', background: '#1a2040', color: '#ccc', border: '1px solid rgba(255,255,255,0.12)' }}>
            {uploading ? 'Lädt hoch…' : '⬆ Bilder hochladen'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          <button onClick={() => pushStream({ visible: false })}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', color: '#888', border: '1px solid rgba(255,255,255,0.1)' }}>
            ▼ HIDE
          </button>
        </div>
        {images.length === 0 ? (
          <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>Noch keine Bilder — lade welche hoch.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {images.map(img => {
              const on = imageOnAir(img.path)
              return (
                <button key={img.id} onClick={() => showImage(img.path)}
                  style={{ padding: 0, border: `2px solid ${on ? '#04a550' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: '#131826', position: 'relative', aspectRatio: '16/9', boxShadow: on ? '0 0 12px rgba(4,165,80,0.35)' : 'none' }}>
                  {img.signedUrl && <img src={img.signedUrl} alt={img.label ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  {on && <div style={{ position: 'absolute', top: 6, left: 6, background: '#04a550', color: '#fff', fontSize: 9, fontWeight: 900, letterSpacing: 1, padding: '2px 6px', borderRadius: 4 }}>ON AIR</div>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Person lower-third ── */}
      <div style={{ background: '#080b14', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: '#444', textTransform: 'uppercase' }}>Personen-Bauchbinde</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.04)', minWidth: 20 }} />
          <button onClick={() => pushStream({ visible: false })}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.04)', color: '#888', border: '1px solid rgba(255,255,255,0.1)' }}>
            ▼ HIDE
          </button>
        </div>
        <input
          value={personSearch}
          onChange={e => setPersonSearch(e.target.value)}
          placeholder="Suche nach Name oder Rolle…"
          style={{ width: '100%', background: '#131826', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#fff', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {people.filter(p => {
            const q = personSearch.toLowerCase()
            return !q || p.name.toLowerCase().includes(q) || (p.role ?? '').toLowerCase().includes(q)
          }).map(p => {
            const on = personOnAir(p.id)
            return (
              <button key={p.id} onClick={() => showPerson(p.id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left', padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                  background: on ? 'rgba(255,29,37,0.16)' : '#171c2e', border: `1px solid ${on ? '#ff1d25' : 'rgba(255,255,255,0.06)'}`, boxShadow: on ? '0 0 12px rgba(255,29,37,0.3)' : 'none' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.15 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: on ? '#ff6b70' : '#7a7a9a', lineHeight: 1.15 }}>{p.role}</span>
                {on && <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: 1, color: '#ff1d25', marginTop: 2 }}>ON AIR</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
