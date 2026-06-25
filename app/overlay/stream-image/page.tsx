'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import StreamImagePanel from '@/components/StreamImagePanel'

type StreamStateRow = {
  id: number
  mode: 'image' | 'person'
  image_url: string | null
  person_id: string | null
  visible: boolean
}

/* ════════════════════════════════════════════
   Stream image overlay — floating 16:9 picture.
════════════════════════════════════════════ */
export default function StreamImageOverlay() {
  const [url, setUrl] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    function apply(state: StreamStateRow) {
      setUrl(state.image_url)
      setVisible(state.visible && state.mode === 'image')
    }

    async function load() {
      const { data } = await supabase.from('stream_overlay_state').select('*').eq('id', 1).single()
      if (data) apply(data as StreamStateRow)
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
