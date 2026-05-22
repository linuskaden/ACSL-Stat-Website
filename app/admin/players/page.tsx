import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function AdminPlayersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const [{ data: players }, { data: teams }] = await Promise.all([
    supabase.from('players').select('*, team:teams(*)').order('last_name'),
    supabase.from('teams').select('*').order('name'),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">Player Management</h1>
        <Link href="/admin/players/new"
          className="bg-[#ff1d25] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-[#e0181f] transition-colors">
          + Add Player
        </Link>
      </div>

      <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-2.5 text-[#7a7a7a] font-medium text-xs">#</th>
              <th className="text-left px-4 py-2.5 text-[#7a7a7a] font-medium text-xs">Player</th>
              <th className="text-left px-4 py-2.5 text-[#7a7a7a] font-medium text-xs">Pos</th>
              <th className="text-left px-4 py-2.5 text-[#7a7a7a] font-medium text-xs">Team</th>
              <th className="text-left px-4 py-2.5 text-[#7a7a7a] font-medium text-xs hidden md:table-cell">Study</th>
              <th className="text-center px-3 py-2.5 text-[#7a7a7a] font-medium text-xs">Active</th>
              <th className="text-right px-4 py-2.5 text-[#7a7a7a] font-medium text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(players ?? []).map((p: any) => (
              <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 text-[#7a7a7a] text-xs font-mono">{p.jersey_number ?? '—'}</td>
                <td className="px-4 py-2.5 font-semibold">
                  {p.first_name} {p.last_name}
                  {p.nickname && <span className="text-[#7a7a7a] font-normal text-xs ml-1">"{p.nickname}"</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-[#7a7a7a]">{p.positions?.join('/') ?? '—'}</td>
                <td className="px-4 py-2.5">
                  {p.team && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: p.team.primary_color }} />
                      <span className="text-xs">{p.team.short_name}</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-[#7a7a7a] hidden md:table-cell max-w-[180px] truncate">
                  {p.field_of_study ?? '—'}
                </td>
                <td className="text-center px-3 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${p.is_active ? 'bg-[#04a550]/20 text-[#04a550]' : 'bg-white/5 text-[#7a7a7a]'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="text-right px-4 py-2.5">
                  <Link href={`/admin/players/${p.id}`}
                    className="text-xs text-[#7a7a7a] hover:text-white transition-colors">
                    Edit →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
