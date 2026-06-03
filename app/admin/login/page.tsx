'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@acsl.at')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Login failed')
      setLoading(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa] dark:bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-black italic tracking-tight text-3xl text-slate-900 dark:text-white mb-3">
            ACSL<span className="text-[#ff1d25]">.</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">ACSL Admin</h1>
          <p className="text-slate-500 dark:text-[#7a7a7a] text-sm mt-1">Operator Access</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-slate-500 dark:text-[#7a7a7a] uppercase tracking-wider block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#ff1d25]"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 dark:text-[#7a7a7a] uppercase tracking-wider block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white dark:bg-[#111] border border-black/10 dark:border-white/10 rounded-lg px-4 py-2.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#ff1d25]"
              required
            />
          </div>

          {error && <p className="text-[#ff1d25] text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff1d25] hover:bg-[#e0181f] disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
