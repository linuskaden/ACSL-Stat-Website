'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import StreamImagePanel from '@/components/StreamImagePanel'

const BUCKET = 'stream-images'

type StreamStateRow = {
  id: number
  mode: 'image' | 'person'
  image_path: string | null
  visible: boolean
}

export default function StreamImageOverlay() {
  const [url, setUrl] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    function getPublicUrl(path: string | null) {
      if (!path) return null
      return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
    }

    function apply(state: StreamStateRow) {
      setVisible(state.visible && state.mode === 'image')
      setUrl(state.mode === 'image' ? getPublicUrl(state.image_path) : null)
    }

    async function load() {
      const { data } = await supabase.from('stream_overlay_state').select('id, mode, image_path, visible').eq('id', 1).single()
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
