'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin'
import { revalidatePath } from 'next/cache'

// Every mutation re-verifies the caller is an admin (server actions are
// reachable by direct POST), then writes with the service-role client so fan
// accounts — which have no write access to the fantasy tables — can't touch it.
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) throw new Error('Forbidden')
  return createAdminClient()
}

const STATUSES = ['upcoming', 'open', 'locked', 'final']

export async function setRoundStatus(roundId: string, status: string) {
  const db = await requireAdmin()
  if (!STATUSES.includes(status)) throw new Error('Invalid status')
  const { error } = await db.from('fantasy_rounds').update({ status }).eq('id', roundId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/fantasy')
}

export async function setLockAt(roundId: string, lockAt: string | null) {
  const db = await requireAdmin()
  const { error } = await db.from('fantasy_rounds').update({ lock_at: lockAt || null }).eq('id', roundId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/fantasy')
}

export async function addGameToRound(roundId: string, gameId: string) {
  const db = await requireAdmin()
  const { error } = await db.from('fantasy_round_games').insert({ round_id: roundId, game_id: gameId })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/fantasy')
}

export async function removeGameFromRound(roundId: string, gameId: string) {
  const db = await requireAdmin()
  const { error } = await db.from('fantasy_round_games').delete().eq('round_id', roundId).eq('game_id', gameId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/fantasy')
}
