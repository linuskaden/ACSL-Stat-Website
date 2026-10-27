'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UsernameForm({ userId }: { userId: string }) {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = username.trim()
    if (name.length < 3) { setError('Mindestens 3 Zeichen.'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.from('fantasy_managers').insert({
      id: userId,
      username: name,
      display_name: name,
    })
    setLoading(false)
    if (error) {
      setError(error.code === '23505' ? 'Username ist schon vergeben.' : error.message)
      return
    }
    router.refresh()
  }

  return (
    <div className="bg-white border border-black/10 rounded-xl p-6 max-w-sm mx-auto">
      <h2 className="font-black text-lg text-slate-900 mb-1">Wähl deinen Namen</h2>
      <p className="text-sm text-slate-500 mb-4">So erscheinst du im Leaderboard. Einmalig.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="z. B. TouchdownToni"
          maxLength={24}
          className="w-full bg-white border border-black/10 rounded-lg px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-[#16163f]"
          required
        />
        {error && <p className="text-[#b4232a] text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#16163f] hover:bg-[#101033] disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Speichere…' : 'Los geht’s'}
        </button>
      </form>
    </div>
  )
}
