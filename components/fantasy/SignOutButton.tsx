'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()
  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.refresh()
  }
  return (
    <button onClick={signOut} className="text-xs font-bold text-slate-500 hover:text-slate-900">
      Abmelden
    </button>
  )
}
