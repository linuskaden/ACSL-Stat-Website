'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type P = { id: string; first_name: string; last_name: string; positions: string[] | null; jersey_number: number | null; team_id: string }
type T = { id: string; name: string; short_name: string | null; primary_color: string | null }
type Entry = {
  qb_id: string | null; rb1_id: string | null; rb2_id: string | null; wr1_id: string | null
  wr2_id: string | null; te_id: string | null; flex_id: string | null; dst_team_id: string | null; captain: string
} | null

const SLOTS = [
  { key: 'QB', label: 'QB', pos: ['QB'] },
  { key: 'RB1', label: 'RB', pos: ['RB'] },
  { key: 'RB2', label: 'RB', pos: ['RB'] },
  { key: 'WR1', label: 'WR', pos: ['WR'] },
  { key: 'WR2', label: 'WR', pos: ['WR'] },
  { key: 'TE', label: 'TE', pos: ['TE'] },
  { key: 'FLEX', label: 'FLEX', pos: ['RB', 'WR', 'TE'] },
  { key: 'DST', label: 'Defense', pos: ['DST'] },
] as const

export default function LineupBuilder({
  roundId, roundName, lockAt, managerId, players, teams, offPts, dstPts, entry,
}: {
  roundId: string; roundName: string; lockAt: string | null; managerId: string
  players: P[]; teams: T[]; offPts: Record<string, number>; dstPts: Record<string, number>; entry: Entry
}) {
  const [picks, setPicks] = useState<Record<string, string | null>>(() => ({
    QB: entry?.qb_id ?? null, RB1: entry?.rb1_id ?? null, RB2: entry?.rb2_id ?? null,
    WR1: entry?.wr1_id ?? null, WR2: entry?.wr2_id ?? null, TE: entry?.te_id ?? null,
    FLEX: entry?.flex_id ?? null, DST: entry?.dst_team_id ?? null,
  }))
  const [captain, setCaptain] = useState<string>(entry?.captain ?? 'QB')
  const [openSlot, setOpenSlot] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [savedScore, setSavedScore] = useState<number | null>(null)
  const [slotScores, setSlotScores] = useState<Record<string, number> | null>(null)

  const playerById = useMemo(() => new Map(players.map(p => [p.id, p])), [players])
  const teamById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams])

  const locked = !!lockAt && Date.now() >= new Date(lockAt).getTime()
  const filled = SLOTS.every(s => picks[s.key])

  function teamShort(id: string | null | undefined) {
    const t = id ? teamById.get(id) : null
    return t?.short_name || t?.name || ''
  }

  function slotBasePoints(slotKey: string): number | undefined {
    const v = picks[slotKey]
    if (!v) return undefined
    return slotKey === 'DST' ? dstPts[v] : offPts[v]
  }

  function eligible(slotKey: string) {
    const slot = SLOTS.find(s => s.key === slotKey)!
    if (slotKey === 'DST') {
      const used = new Set(Object.entries(picks).filter(([k]) => k !== 'DST').map(([, v]) => v))
      return teams
        .filter(t => !used.has(t.id))
        .map(t => ({ id: t.id, label: t.name, sub: 'Team-Defense', pts: dstPts[t.id], color: t.primary_color }))
        .sort((a, b) => (b.pts ?? -99) - (a.pts ?? -99))
    }
    const usedElsewhere = new Set(
      Object.entries(picks).filter(([k]) => k !== slotKey).map(([, v]) => v).filter(Boolean) as string[]
    )
    const q = search.trim().toLowerCase()
    const slotPos = slot.pos as readonly string[]
    return players
      .filter(p => (p.positions ?? []).some(pos => slotPos.includes(pos)))
      .filter(p => !usedElsewhere.has(p.id))
      .filter(p => !q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q))
      .map(p => ({
        id: p.id,
        label: `${p.first_name} ${p.last_name}`,
        sub: `${teamShort(p.team_id)}${p.jersey_number ? ` · #${p.jersey_number}` : ''}`,
        pts: offPts[p.id],
        color: teamById.get(p.team_id)?.primary_color ?? null,
      }))
      .sort((a, b) => (b.pts ?? -99) - (a.pts ?? -99))
  }

  function pick(slotKey: string, id: string) {
    setPicks(prev => ({ ...prev, [slotKey]: id }))
    setOpenSlot(null)
    setSearch('')
    setSavedScore(null); setSlotScores(null); setMsg('')
  }

  async function save() {
    setSaving(true); setMsg('')
    const supabase = createClient()
    const row = {
      manager_id: managerId, round_id: roundId,
      qb_id: picks.QB, rb1_id: picks.RB1, rb2_id: picks.RB2, wr1_id: picks.WR1, wr2_id: picks.WR2,
      te_id: picks.TE, flex_id: picks.FLEX, dst_team_id: picks.DST, captain,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('fantasy_entries').upsert(row, { onConflict: 'manager_id,round_id' })
    if (error) { setSaving(false); setMsg(error.message); return }
    const [{ data: sc }, { data: slots }] = await Promise.all([
      supabase.from('fantasy_entry_scores').select('points').eq('round_id', roundId).eq('manager_id', managerId).maybeSingle(),
      supabase.from('fantasy_entry_slot_points').select('slot,points').eq('round_id', roundId).eq('manager_id', managerId),
    ])
    const sm: Record<string, number> = {}
    for (const s of (slots ?? []) as { slot: string; points: number }[]) sm[s.slot] = s.points
    setSavedScore(sc?.points != null ? Number(sc.points) : null)
    setSlotScores(sm)
    setSaving(false)
    setMsg('Lineup gespeichert.')
  }

  const labelFor = (slotKey: string) => {
    const v = picks[slotKey]
    if (!v) return null
    if (slotKey === 'DST') { const t = teamById.get(v); return t ? (t.name) : null }
    const p = playerById.get(v); return p ? `${p.first_name} ${p.last_name}` : null
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="flex items-baseline justify-between mb-1">
        <h1 className="text-2xl font-black text-slate-900">Dein Lineup</h1>
        <span className="text-sm font-bold text-[#16163f]">{roundName}</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        1 QB · 2 RB · 2 WR · 1 TE · 1 FLEX · 1 Defense. Tipp auf den Stern = Captain (zählt doppelt).
        {locked && <span className="text-[#b4232a] font-bold"> · Gesperrt</span>}
      </p>

      <div className="space-y-2">
        {SLOTS.map(slot => {
          const name = labelFor(slot.key)
          const base = slotBasePoints(slot.key)
          const isCap = captain === slot.key
          const shown = slotScores?.[slot.key]
          return (
            <div key={slot.key}
              className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 ${isCap ? 'border-[#16163f] ring-1 ring-[#16163f]' : 'border-black/10'}`}>
              <span className="w-12 shrink-0 text-xs font-black uppercase tracking-wide text-slate-400">{slot.label}</span>
              <button
                disabled={locked}
                onClick={() => { setOpenSlot(slot.key); setSearch('') }}
                className="flex-1 text-left min-w-0"
              >
                {name ? (
                  <span className="font-bold text-slate-900 truncate block">{name}</span>
                ) : (
                  <span className="text-slate-400">Spieler wählen…</span>
                )}
                {name && (
                  <span className="text-[11px] text-slate-500">
                    {slot.key === 'DST' ? teamShort(picks.DST) : `${teamShort(playerById.get(picks[slot.key]!)?.team_id)}`}
                    {base != null && <> · letzte Round {base} P</>}
                  </span>
                )}
              </button>
              {shown != null && (
                <span className="text-sm font-black text-[#16163f] tabular-nums">{shown}</span>
              )}
              <button
                disabled={locked || !name}
                onClick={() => name && setCaptain(slot.key)}
                title="Captain (x2)"
                className={`shrink-0 text-lg leading-none ${isCap ? 'text-[#16163f]' : 'text-slate-300 hover:text-slate-500'} disabled:opacity-30`}
              >
                {isCap ? '★' : '☆'}
              </button>
            </div>
          )
        })}
      </div>

      {savedScore != null && (
        <div className="mt-4 rounded-xl bg-[#16163f] text-white px-4 py-3 flex items-center justify-between">
          <span className="font-bold">Dein Score ({roundName})</span>
          <span className="text-2xl font-black tabular-nums">{savedScore}</span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!filled || saving || locked}
          className="flex-1 bg-[#16163f] hover:bg-[#101033] disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {saving ? 'Speichere…' : filled ? 'Lineup speichern' : `Noch ${SLOTS.filter(s => !picks[s.key]).length} Slot(s) offen`}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-slate-600 text-center">{msg}</p>}

      {openSlot && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOpenSlot(null)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-black/10">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-slate-900">{SLOTS.find(s => s.key === openSlot)!.label} wählen</h3>
                <button onClick={() => setOpenSlot(null)} className="text-slate-400 text-sm font-bold">Schließen</button>
              </div>
              {openSlot !== 'DST' && (
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Spieler suchen…"
                  className="w-full bg-white border border-black/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#16163f]"
                />
              )}
            </div>
            <div className="overflow-y-auto">
              {eligible(openSlot).map(o => (
                <button
                  key={o.id}
                  onClick={() => pick(openSlot, o.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left border-b border-black/5"
                >
                  <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: o.color ?? '#16163f' }} />
                  <span className="flex-1 min-w-0">
                    <span className="font-bold text-slate-900 block truncate">{o.label}</span>
                    <span className="text-[11px] text-slate-500">{o.sub}</span>
                  </span>
                  <span className="text-sm font-black text-slate-700 tabular-nums">{o.pts != null ? `${o.pts}` : '–'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
