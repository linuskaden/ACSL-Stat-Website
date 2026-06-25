'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import StreamImagePanel from '@/components/StreamImagePanel'

type StreamStateRow = {
  id: number
  mode: 'image' | 'person'
  image_path: string | null
  visible: boolean
}

/* ════════════════════════════════════════════
   Stream image overlay — floating 16:9 picture.
   The bucket is private, so the actual image URL is a
   short-lived signed link fetched from /api/stream-image-url
   (re-fetched whenever the active image changes).
════════════════════════════════════════════ */
export default function StreamImageOverlay() {
  const [url, setUrl] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function refreshSignedUrl() {
      try {
        const res = await fetch('/api/stream-image-url', { cache: 'no-store' })
        const data = await res.json()
        setUrl(data.url ?? null)
      } catch { setUrl(null) }
    }

    async function apply(state: StreamStateRow) {
      setVisible(state.visible && state.mode === 'image')
      if (state.mode === 'image' && state.image_path) await refreshSignedUrl()
      else setUrl(null)
    }

    async function load() {
      const { data } = await supabase.from('stream_overlay_state').select('id, mode, image_path, visible').eq('id', 1).single()
      if (data) await apply(data as StreamStateRow)
    }
    load()

    const ch = supabase.channel('stream-image-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_overlay_state' },
        ({ new: row }) => apply(row as StreamStateRow))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  return <StreamImagePanel url={url} visible={visible} />
}
