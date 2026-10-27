'use client'
import { useState, useTransition } from 'react'

type Game = { id: string; home: string; away: string; scheduled_at: string | null; status: string; score: string | null }
type Round = { id: string; name: string; status: string; lock_at: string | null }

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'Geplant', open: 'Offen', locked: 'Gesperrt', final: 'Abgeschlossen',
}
const STATUS_STYLE: Record<string, string> = {
  upcoming: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-[#aaa]',
  open: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  locked: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  final: 'bg-[#16163f]/10 text-[#16163f] dark:bg-white/10 dark:text-white',
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtGameDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function FantasyAdminClient({
  rounds, gamesByRound, availableGames,
  onSetStatus, onSetLock, onAddGame, onRemoveGame,
}: {
  rounds: Round[]
  gamesByRound: Record<string, Game[]>
  availableGames: Game[]
  onSetStatus: (roundId: string, status: string) => Promise<void>
  onSetLock: (roundId: string, lockAt: string | null) => Promise<void>
  onAddGame: (roundId: string, gameId: string) => Promise<void>
  onRemoveGame: (roundId: string, gameId: string) => Promise<void>
}) {
  const [pending, startTransition] = useTransition()
  const [addSel, setAddSel] = useState<Record<string, string>>({})
  const [lockDraft, setLockDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(rounds.map(r => [r.id, toLocalInput(r.lock_at)]))
  )

  const gameLabel = (g: Game) =>
    `${g.home} vs ${g.away} · ${fmtGameDate(g.scheduled_at)}${g.score ? ` · ${g.score}` : ''} · ${g.status}`

  return (
    <div className="space-y-4">
      {rounds.map(r => {
        const games = gamesByRound[r.id] ?? []
        const sel = addSel[r.id] ?? ''
        return (
          <div key={r.id} className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-black text-slate-900 dark:text-white truncate">{r.name}</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] ?? ''}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
              <select
                value={r.status}
                disabled={pending}
                onChange={e => startTransition(() => onSetStatus(r.id, e.target.value))}
                className="text-xs bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white"
              >
                <option value="upcoming">Geplant</option>
                <option value="open">Offen (Lineups)</option>
                <option value="locked">Gesperrt</option>
                <option value="final">Abgeschlossen (Scoring)</option>
              </select>
            </div>

            {/* Lock time */}
            <div className="flex items-end gap-2 mb-3">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">Lineup-Deadline (lock_at)</label>
                <input
                  type="datetime-local"
                  value={lockDraft[r.id] ?? ''}
                  onChange={e => setLockDraft(prev => ({ ...prev, [r.id]: e.target.value }))}
                  className="w-full text-xs bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white"
                />
              </div>
              <button
                disabled={pending}
                onClick={() => startTransition(() => onSetLock(r.id, lockDraft[r.id] ? new Date(lockDraft[r.id]).toISOString() : null))}
                className="text-xs font-bold bg-[#16163f] text-white px-3 py-1.5 rounded-lg hover:bg-[#101033] disabled:opacity-40"
              >
                Setzen
              </button>
              {r.lock_at && (
                <button
                  disabled={pending}
                  onClick={() => { setLockDraft(prev => ({ ...prev, [r.id]: '' })); startTransition(() => onSetLock(r.id, null)) }}
                  className="text-xs font-bold text-slate-500 px-2 py-1.5 rounded-lg hover:text-[#b4232a]"
                >
                  Löschen
                </button>
              )}
            </div>

            {/* Assigned games */}
            <div className="space-y-1.5 mb-3">
              {games.length === 0 ? (
                <p className="text-xs text-slate-400">Noch keine Spiele zugeordnet.</p>
              ) : games.map(g => (
                <div key={g.id} className="flex items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-slate-700 dark:text-[#ccc] truncate">{gameLabel(g)}</span>
                  <button
                    disabled={pending}
                    onClick={() => startTransition(() => onRemoveGame(r.id, g.id))}
                    className="shrink-0 text-slate-400 hover:text-[#b4232a] font-bold"
                    title="Entfernen"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Add game */}
            <div className="flex items-center gap-2">
              <select
                value={sel}
                disabled={pending || availableGames.length === 0}
                onChange={e => setAddSel(prev => ({ ...prev, [r.id]: e.target.value }))}
                className="flex-1 text-xs bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-2 py-1.5 text-slate-900 dark:text-white"
              >
                <option value="">{availableGames.length === 0 ? 'Keine freien Spiele' : 'Spiel hinzufügen…'}</option>
                {availableGames.map(g => (
                  <option key={g.id} value={g.id}>{gameLabel(g)}</option>
                ))}
              </select>
              <button
                disabled={pending || !sel}
                onClick={() => { if (sel) { startTransition(() => onAddGame(r.id, sel)); setAddSel(prev => ({ ...prev, [r.id]: '' })) } }}
                className="text-xs font-bold bg-[#16163f] text-white px-3 py-1.5 rounded-lg hover:bg-[#101033] disabled:opacity-40"
              >
                Hinzufügen
              </button>
            </div>
          </div>
        )
      })}
      <p className="text-xs text-slate-400 dark:text-[#777]">
        Status <b>Offen</b> = Lineups können gestellt werden (bis zur Deadline). <b>Abgeschlossen</b> = Scoring &amp; Leaderboard werden berechnet.
        Jedes Spiel gehört zu genau einer Round.
      </p>
    </div>
  )
}
