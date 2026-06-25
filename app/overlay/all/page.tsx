import LowerThirdOverlay from '@/components/overlays/LowerThirdOverlay'
import TeamStatsOverlay from '@/components/overlays/TeamStatsOverlay'
import KeyPlayersOverlay from '@/components/overlays/KeyPlayersOverlay'
import LineupOverlay from '@/components/overlays/LineupOverlay'
import StreamImageOverlay from '@/components/overlays/StreamImageOverlay'
import StreamPersonOverlay from '@/components/overlays/StreamPersonOverlay'

/* ════════════════════════════════════════════
   One vMix browser input that hosts every overlay.
   Each child reads its own state and shows/hides itself
   via realtime; they are mutually exclusive (except the
   permanent key-player ticker), so only one big graphic
   is visible at a time. Rendered fullscreen-first so the
   bottom-corner graphics layer on top.
════════════════════════════════════════════ */
export default function AllOverlays() {
  return (
    <>
      <TeamStatsOverlay />
      <StreamImageOverlay />
      <LineupOverlay />
      <LowerThirdOverlay />
      <StreamPersonOverlay />
      <KeyPlayersOverlay />
    </>
  )
}
