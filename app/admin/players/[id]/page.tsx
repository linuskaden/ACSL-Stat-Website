import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import DeletePlayerButton from './DeletePlayerButton'

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P']

export default async function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isNew = id === 'new'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: teams } = await supabase.from('teams').select('*').order('name')
  const player = isNew ? null : (await supabase.from('players').select('*').eq('id', id).single()).data
  if (!isNew && !player) notFound()

  async function savePlayer(formData: FormData) {
    'use server'
    const supabase = await createClient()
    const positions = formData.getAll('positions') as string[]
    const data = {
      team_id: formData.get('team_id') as string || null,
      jersey_number: formData.get('jersey_number') ? Number(formData.get('jersey_number')) : null,
      positions,
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      nickname: formData.get('nickname') as string || null,
      hometown: formData.get('hometown') as string || null,
      state_province: formData.get('state_province') as string || null,
      country: formData.get('country') as string || null,
      date_of_birth: formData.get('date_of_birth') as string || null,
      height_cm: formData.get('height_cm') ? Number(formData.get('height_cm')) : null,
      weight_kg: formData.get('weight_kg') ? Number(formData.get('weight_kg')) : null,
      field_of_study: formData.get('field_of_study') as string || null,
      semester: formData.get('semester') as string || null,
      acsl_since: formData.get('acsl_since') as string || null,
      football_experience: formData.get('football_experience') as string || null,
      fun_fact: formData.get('fun_fact') as string || null,
      notes: formData.get('notes') as string || null,
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
    await supabase.from('players').delete().eq('id', id)
    redirect('/admin/players')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/players" className="text-xs text-[#7a7a7a] hover:text-white">← Players</Link>
        <h1 className="text-2xl font-black">{isNew ? 'Add Player' : 'Edit Player'}</h1>
      </div>

      {/* ── Save form ── */}
      <form action={savePlayer} className="space-y-6">
        <Section title="Basic Info">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" name="first_name" defaultValue={player?.first_name} required />
            <Field label="Last Name" name="last_name" defaultValue={player?.last_name} required />
            <Field label="Nickname" name="nickname" defaultValue={player?.nickname ?? ''} />
            <Field label="Jersey #" name="jersey_number" type="number" defaultValue={player?.jersey_number?.toString() ?? ''} />
          </div>

          <div>
            <label className="text-xs text-[#7a7a7a] uppercase tracking-wider block mb-2">Team</label>
            <select name="team_id" defaultValue={player?.team_id ?? ''}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff1d25]">
              <option value="">No Team</option>
              {(teams ?? []).map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#7a7a7a] uppercase tracking-wider block mb-2">Positions</label>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map(pos => (
                <label key={pos} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" name="positions" value={pos}
                    defaultChecked={player?.positions?.includes(pos)}
                    className="accent-[#ff1d25]" />
                  <span className="text-sm text-white">{pos}</span>
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
            <label className="text-xs text-[#7a7a7a] uppercase tracking-wider block mb-2">Active Status</label>
            <select name="is_active" defaultValue={player?.is_active !== false ? 'true' : 'false'}
              className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff1d25]">
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
          <Link href="/admin/players" className="text-[#7a7a7a] hover:text-white text-sm transition-colors">Cancel</Link>
        </div>
      </form>

      {/* ── Delete form (outside save form to avoid nesting) ── */}
      {!isNew && (
        <div className="flex justify-end mt-4">
          <DeletePlayerButton action={deletePlayer} />
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-[#111] border border-white/5 rounded-xl p-5 space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#7a7a7a]">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, name, defaultValue, type = 'text', required, textarea }: {
  label: string; name: string; defaultValue?: string; type?: string; required?: boolean; textarea?: boolean
}) {
  const cls = "w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff1d25]"
  return (
    <div>
      <label className="text-xs text-[#7a7a7a] uppercase tracking-wider block mb-1.5">{label}</label>
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue} rows={2} className={cls} />
      ) : (
        <input name={name} type={type} defaultValue={defaultValue} required={required} className={cls} />
      )}
    </div>
  )
}
