'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function FantasyLogin() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=/fantasy` },
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-black italic tracking-tight text-3xl text-slate-900 mb-2">
            ACSL<span className="text-[#16163f]">.</span>Fantasy
          </div>
          <p className="text-slate-500 text-sm">Stell dein Lineup. Jede Round zählt.</p>
        </div>

        {sent ? (
          <div className="bg-white border border-black/10 rounded-xl p-6 text-center">
            <p className="font-bold text-slate-900 mb-1">Check deine Mails</p>
            <p className="text-sm text-slate-500">
              Wir haben dir einen Login-Link an <b>{email}</b> geschickt. Klick ihn, um dich anzumelden.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="du@example.com"
                className="w-full bg-white border border-black/10 rounded-lg px-4 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-[#16163f]"
                required
              />
            </div>
            {error && <p className="text-[#b4232a] text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#16163f] hover:bg-[#101033] disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Sende Link…' : 'Login-Link schicken'}
            </button>
            <p className="text-xs text-slate-400 text-center">Kein Passwort nötig — du kriegst einen Magic-Link per Mail.</p>
          </form>
        )}
      </div>
    </div>
  )
}
