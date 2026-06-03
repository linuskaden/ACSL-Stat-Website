import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import DeletePlayerButton from './DeletePlayerButton'
import { formatDate } from '@/lib/utils'

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P']

const NUM_FIELDS = [
  'pass_yards', 'pass_completions', 'pass_attempts', 'pass_tds', 'interceptions_thrown',
  'qb_rush_yards', 'qb_rush_tds',
  'rush_carries', 'rush_yards', 'rush_tds',
  'rb_rec_yards', 'rb_receptions', 'rb_targets', 'rb_fumbles',
  'rec_yards', 'receptions', 'rec_targets', 'rec_tds', 'rec_fumbles',
  'sacks', 'def_interceptions',
  'fg_made', 'fg_attempts', 'ep_made', 'ep_attempts',
] as const

export default async function EditPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const isNew = id === 'new'
  const activeTab = (!isNew && tab === 'stats') ? 'stats' : 'edit'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: teams } = await supabase.from('teams').select('*').order('name')
  const player = isNew ? null : (await supabase.from('players').select('*').eq('id', id).single()).data
  if (!isNew && !player) notFound()

  /* ─── Server Actions (unchanged) ─── */

  async function savePlayer(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Helpers
    const str = (key: string, max: number) =>
      ((formData.get(key) as string | null)?.trim().slice(0, max)) || null
    const num = (key: string, min: number, max: number) => {
      const raw = formData.get(key)
      if (!raw) return null
      const n = Number(raw)
      return Number.isFinite(n) && n >= min && n <= max ? n : null
    }

    const VALID_POSITIONS = ['QB','RB','WR','TE','OL','DL','LB','DB','K','P']
    const positions = (formData.getAll('positions') as string[]).filter(p => VALID_POSITIONS.includes(p))
    if (positions.length === 0) return

    const first_name = str('first_name', 100)
    const last_name  = str('last_name',  100)
    if (!first_name || !last_name) return

    const data = {
      team_id:             str('team_id', 36) || null,
      jersey_number:       num('jersey_number', 0, 99),
      positions,
      first_name,
      last_name,
      nickname:            str('nickname', 100),
      hometown:            str('hometown', 200),
      state_province:      str('state_province', 100),
      country:             str('country', 100),
      date_of_birth:       str('date_of_birth', 20),
      height_cm:           num('height_cm', 100, 250),
      weight_kg:           num('weight_kg', 30, 200),
      field_of_study:      str('field_of_study', 200),
      semester:            str('semester', 50),
      acsl_since:          str('acsl_since', 20),
      football_experience: str('football_experience', 500),
      fun_fact:            str('fun_fact', 500),
      notes:               str('notes', 500),
      is_active: formData.get('is_active') === 'true',
    }

    if (isNew) {
      await supabase.from('players').insert(data)
    } else {
      await supabase.from('players').update(data).eq('id', id)
    }
    redirect('/admin/players')
  }

  async function deletePlayer() {
    'use server'
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('players').delete().eq('id', id)
    redirect('/admin/players')
  }

  /* ─── Extra data for Career Stats tab ─── */
  let career: any[] = []
  let gameStatsRaw: any[] = []
  let gamesData: any[] = []

  if (activeTab === 'stats' && !isNew) {
    const [csResult, gsResult] = await Promise.all([
      supabase.from('career_stats').select('*').eq('player_id', id).order('season', { ascending: false }),
      supabase.from('game_stats').select('*').eq('player_id', id),
    ])
    career = csResult.data ?? []
    gameStatsRaw = gsResult.data ?? []

    if (gameStatsRaw.length > 0) {
      const gameIds = [...new Set(gameStatsRaw.map((r: any) => r.game_id))]
      const { data: gd } = await supabase
        .from('games')
        .select('id, scheduled_at, home_score, away_score, home_team:teams!games_home_team_id_fkey(short_name), away_team:teams!games_away_team_id_fkey(short_name)')
        .in('id', gameIds)
      gamesData = gd ?? []
    }
  }

  /* ─── Render ─── */
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/admin/players" className="text-xs text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white">← Players</Link>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">{isNew ? 'Add Player' : 'Edit Player'}</h1>
      </div>

      {/* Tab nav — only for existing players */}
      {!isNew && (
        <div className="flex gap-1 mb-6">
          <Link
            href={`/admin/players/${id}?tab=edit`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'edit' ? 'bg-[#ff1d25] text-white' : 'text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/5'
            }`}
          >
            Bearbeiten
          </Link>
          <Link
            href={`/admin/players/${id}?tab=stats`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'stats' ? 'bg-[#ff1d25] text-white' : 'text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/5'
            }`}
          >
            Career Stats
          </Link>
        </div>
      )}

      {/* ── Edit Tab ── */}
      {activeTab === 'edit' && (
        <>
          <form action={savePlayer} className="space-y-6">
            <Section title="Basic Info">
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name" name="first_name" defaultValue={player?.first_name} required />
                <Field label="Last Name" name="last_name" defaultValue={player?.last_name} required />
                <Field label="Nickname" name="nickname" defaultValue={player?.nickname ?? ''} />
                <Field label="Jersey #" name="jersey_number" type="number" defaultValue={player?.jersey_number?.toString() ?? ''} />
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-[#7a7a7a] uppercase tracking-wider block mb-2">Team</label>
                <select name="team_id" defaultValue={player?.team_id ?? ''}
                  className="w-full bg-[#f7f8fa] dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#ff1d25]">
                  <option value="">No Team</option>
                  {(teams ?? []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-[#7a7a7a] uppercase tracking-wider block mb-2">Positions</label>
                <div className="flex flex-wrap gap-2">
                  {POSITIONS.map(pos => (
                    <label key={pos} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" name="positions" value={pos}
                        defaultChecked={player?.positions?.includes(pos)}
                        className="accent-[#ff1d25]" />
                      <span className="text-sm text-slate-700 dark:text-white">{pos}</span>
                    </label>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Personal Info">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Hometown" name="hometown" defaultValue={player?.hometown ?? ''} />
                <Field label="State/Province" name="state_province" defaultValue={player?.state_province ?? ''} />
                <Field label="Country" name="country" defaultValue={player?.country ?? ''} />
                <Field label="Date of Birth" name="date_of_birth" type="date" defaultValue={player?.date_of_birth ?? ''} />
                <Field label="Height (cm)" name="height_cm" type="number" defaultValue={player?.height_cm?.toString() ?? ''} />
                <Field label="Weight (kg)" name="weight_kg" type="number" defaultValue={player?.weight_kg?.toString() ?? ''} />
              </div>
            </Section>

            <Section title="Academic & ACSL">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Field of Study" name="field_of_study" defaultValue={player?.field_of_study ?? ''} />
                <Field label="Semester" name="semester" defaultValue={player?.semester ?? ''} />
                <Field label="ACSL Since" name="acsl_since" defaultValue={player?.acsl_since ?? ''} />
              </div>
              <Field label="Football Experience" name="football_experience" defaultValue={player?.football_experience ?? ''} textarea />
              <Field label="Fun Fact" name="fun_fact" defaultValue={player?.fun_fact ?? ''} textarea />
              <Field label="Notes" name="notes" defaultValue={player?.notes ?? ''} textarea />
            </Section>

            <Section title="Status">
              <div>
                <label className="text-xs text-slate-500 dark:text-[#7a7a7a] uppercase tracking-wider block mb-2">Active Status</label>
                <select name="is_active" defaultValue={player?.is_active !== false ? 'true' : 'false'}
                  className="bg-[#f7f8fa] dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#ff1d25]">
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </Section>

            <div className="flex items-center gap-4 pt-2">
              <button type="submit"
                className="bg-[#ff1d25] hover:bg-[#e0181f] text-white font-bold px-6 py-2.5 rounded-lg transition-colors">
                {isNew ? 'Add Player' : 'Save Changes'}
              </button>
              <Link href="/admin/players" className="text-slate-500 dark:text-[#7a7a7a] hover:text-slate-900 dark:hover:text-white text-sm transition-colors">Cancel</Link>
            </div>
          </form>

          {/* Delete form (outside save form to avoid nesting) */}
          {!isNew && (
            <div className="flex justify-end mt-4">
              <DeletePlayerButton action={deletePlayer} />
            </div>
          )}
        </>
      )}

      {/* ── Career Stats Tab ── */}
      {activeTab === 'stats' && !isNew && (
        <AdminStatsContent
          career={career}
          gameStatsRaw={gameStatsRaw}
          gamesData={gamesData}
          positions={player?.positions ?? []}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   Admin Career Stats Content (server-rendered)
══════════════════════════════════════════ */
function AdminStatsContent({
  career,
  gameStatsRaw,
  gamesData,
  positions,
}: {
  career: any[]
  gameStatsRaw: any[]
  gamesData: any[]
  positions: string[]
}) {
  /* ── Derive position-filtered columns for tables ── */
  const isQB  = positions.includes('QB')
  const isRB  = positions.includes('RB')
  const isRec = positions.some(p => ['WR', 'TE'].includes(p))
  const isDef = positions.some(p => ['DL', 'LB', 'DB'].includes(p))
  const isKP  = positions.some(p => ['K', 'P'].includes(p))

  type Col = { label: string; field: string }
  const cols: Col[] = []
  if (isQB)  cols.push(
    { label: 'Pass YDS', field: 'pass_yards' },
    { label: 'Comp',     field: 'pass_completions' },
    { label: 'Att',      field: 'pass_attempts' },
    { label: 'Pass TDs', field: 'pass_tds' },
    { label: 'INT',      field: 'interceptions_thrown' },
    { label: 'Rush YDS', field: 'qb_rush_yards' },
    { label: 'Rush TDs', field: 'qb_rush_tds' },
  )
  if (isRB)  cols.push(
    { label: 'Carries',  field: 'rush_carries' },
    { label: 'Rush YDS', field: 'rush_yards' },
    { label: 'Rush TDs', field: 'rush_tds' },
    { label: 'Rec YDS',  field: 'rb_rec_yards' },
    { label: 'Rec',      field: 'rb_receptions' },
    { label: 'Tar',      field: 'rb_targets' },
    { label: 'Fumbles',  field: 'rb_fumbles' },
  )
  if (isRec) cols.push(
    { label: 'Rec YDS', field: 'rec_yards' },
    { label: 'Rec',     field: 'receptions' },
    { label: 'Rec TDs', field: 'rec_tds' },
    { label: 'Targets', field: 'rec_targets' },
    { label: 'Fumbles', field: 'rec_fumbles' },
  )
  if (isDef) cols.push(
    { label: 'Sacks', field: 'sacks' },
    { label: 'INT',   field: 'def_interceptions' },
  )
  if (isKP)  cols.push(
    { label: 'FGM', field: 'fg_made' },
    { label: 'FGA', field: 'fg_attempts' },
    { label: 'EPM', field: 'ep_made' },
    { label: 'EPA', field: 'ep_attempts' },
  )
  // Fallback — show basic DEF columns if no position matched
  if (cols.length === 0) {
    cols.push({ label: 'Sacks', field: 'sacks' }, { label: 'INT', field: 'def_interceptions' })
  }

  /* ── Aggregate game_stats by game_id ── */
  const gameMap = new Map<string, Record<string, number>>()
  for (const row of gameStatsRaw) {
    if (!gameMap.has(row.game_id)) {
      gameMap.set(row.game_id, Object.fromEntries(NUM_FIELDS.map(f => [f, 0])))
    }
    const acc = gameMap.get(row.game_id)!
    for (const f of NUM_FIELDS) {
      acc[f] = (acc[f] ?? 0) + ((row as any)[f] ?? 0)
    }
  }

  const gameRows = [...gameMap.entries()]
    .map(([gameId, totals]) => ({
      gameId,
      totals,
      game: gamesData.find((g: any) => g.id === gameId) ?? null,
    }))
    .sort((a, b) => {
      const da = a.game?.scheduled_at ?? ''
      const db = b.game?.scheduled_at ?? ''
      return da < db ? -1 : 1
    })

  const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-400 dark:text-[#7a7a7a] uppercase tracking-wider whitespace-nowrap border-b border-black/10 dark:border-white/10'
  const td = 'px-3 py-2 text-xs text-slate-900 dark:text-white whitespace-nowrap'
  const tdNum = 'px-3 py-2 text-xs text-slate-900 dark:text-white text-center whitespace-nowrap'

  return (
    <div className="space-y-6">
      {/* ── Section A: Season Totals ── */}
      <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-4">Season Totals</h2>
        {career.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-[#7a7a7a]">No career stats recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Season</th>
                  <th className={th}>GP</th>
                  {cols.map(c => <th key={c.field} className={th}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {career.map((cs: any) => (
                  <tr key={cs.id} className="border-b border-black/[0.05] dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className={td}>{cs.season}</td>
                    <td className={tdNum}>{cs.games_played ?? 0}</td>
                    {cols.map(c => (
                      <td key={c.field} className={tdNum}>{(cs as any)[c.field] ?? 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section B: Per-Game Breakdown ── */}
      <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a] mb-4">Per-Game Breakdown</h2>
        {gameRows.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-[#7a7a7a]">No game stats recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Date</th>
                  <th className={th}>Opponent</th>
                  <th className={th}>Score</th>
                  {cols.map(c => <th key={c.field} className={th}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {gameRows.map(({ gameId, totals, game }) => {
                  const homeShort = (game as any)?.home_team?.short_name ?? '?'
                  const awayShort = (game as any)?.away_team?.short_name ?? '?'
                  return (
                    <tr key={gameId} className="border-b border-black/[0.05] dark:border-white/5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <td className={td}>{formatDate(game?.scheduled_at ?? null)}</td>
                      <td className={td}>{homeShort} vs {awayShort}</td>
                      <td className={tdNum}>
                        {game ? `${game.home_score ?? 0}–${game.away_score ?? 0}` : '—'}
                      </td>
                      {cols.map(c => (
                        <td key={c.field} className={tdNum}>{totals[c.field] ?? 0}</td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Shared form helpers ─── */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#111] border border-black/[0.07] dark:border-white/5 rounded-xl p-5 space-y-4 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#7a7a7a]">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, name, defaultValue, type = 'text', required, textarea }: {
  label: string; name: string; defaultValue?: string; type?: string; required?: boolean; textarea?: boolean
}) {
  const cls = "w-full bg-[#f7f8fa] dark:bg-[#0a0a0a] border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#ff1d25]"
  return (
    <div>
      <label className="text-xs text-slate-500 dark:text-[#7a7a7a] uppercase tracking-wider block mb-1.5">{label}</label>
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue} rows={2} className={cls} />
      ) : (
        <input name={name} type={type} defaultValue={defaultValue} required={required} className={cls} />
      )}
    </div>
  )
}
