import { cookies, headers } from 'next/headers'
import { resolveCompetition, COMPETITION_COOKIE, type Competition } from './competition-client'

// Re-export the client-safe constants/types so `@/lib/competition` stays the
// single import for server code.
export * from './competition-client'

/**
 * Server-side: resolve the active competition from the request's host header
 * and the division cookie. Reading these opts the route into dynamic rendering.
 */
export async function getSelectedCompetition(): Promise<Competition> {
  let cookie: string | undefined
  try { cookie = (await cookies()).get(COMPETITION_COOKIE)?.value } catch {}

  let host = ''
  try { host = (await headers()).get('host') ?? '' } catch {}

  return resolveCompetition(host, cookie)
}
