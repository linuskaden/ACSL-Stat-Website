'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import StreamPersonBand, { type StreamPerson } from '@/components/StreamPersonBand'

type StreamStateRow = {
  id: number
  mode: 'image' | 'person'
  image_url: string | null
  person_id: string | null
  visible: boolean
}

/* ════════════════════════════════════════════
   Stream person overlay — ACSL crew lower-third.
════════════════════════════════════════════ */
export default function StreamPersonOverlay() {
  const [person, setPerson] = useState<StreamPerson | null>(null)
  const [visible, setVisible] = useState(false)
  const personIdRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function apply(state: StreamStateRow) {
      const show = state.visible && state.mode === 'person'
      setVisible(show)
      if (state.person_id && state.person_id !== personIdRef.current) {
        personIdRef.current = state.person_id
        const { data } = await supabase.from('stream_people').select('name, role, logo_url').eq('id', state.person_id).single()
        setPerson((data as StreamPerson) ?? null)
      } else if (!state.person_id) {
        personIdRef.current = null
        setPerson(null)
      }
    }

    async function load() {
      const { data } = await supabase.from('stream_overlay_state').select('*').eq('id', 1).single()
      if (data) await apply(data as StreamStateRow)
    }
    load()

    const ch = supabase.channel('stream-person-overlay')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stream_overlay_state' },
        ({ new: row }) => apply(row as StreamStateRow))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  return <StreamPersonBand person={person} visible={visible} />
}
