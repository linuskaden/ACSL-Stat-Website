/* Client-safe competition constants + a pure resolver (no next/headers).
   Server code uses lib/competition.ts, which re-exports all of this and adds
   getSelectedCompetition(). Client components import from here directly. */

export type CompetitionKey = 'football' | 'basketball_men' | 'basketball_women'
export type Sport = 'football' | 'basketball'

export type Competition = {
  id: string
  key: CompetitionKey
  sport: Sport
  division: 'men' | 'women' | null
  name: string
  subdomain: string
  defaultSeason: number
}

// Fixed ids — must match the seeded rows in public.competitions.
export const COMPETITIONS: Record<CompetitionKey, Competition> = {
  football: {
    id: '00000000-0000-0000-0000-0000000000f1',
    key: 'football', sport: 'football', division: null,
    name: 'ACSL Football', subdomain: 'football', defaultSeason: 2027,
  },
  basketball_men: {
    id: '00000000-0000-0000-0000-0000000000b1',
    key: 'basketball_men', sport: 'basketball', division: 'men',
    name: 'ACSL Basketball Herren', subdomain: 'basketball', defaultSeason: 2026,
  },
  basketball_women: {
    id: '00000000-0000-0000-0000-0000000000b2',
    key: 'basketball_women', sport: 'basketball', division: 'women',
    name: 'ACSL Basketball Damen', subdomain: 'basketball', defaultSeason: 2026,
  },
}

export const COMPETITION_LIST: Competition[] = Object.values(COMPETITIONS)
export const DEFAULT_COMPETITION: CompetitionKey = 'football'
export const COMPETITION_COOKIE = 'acsl-competition'

export function isCompetitionKey(v: unknown): v is CompetitionKey {
  return typeof v === 'string' && v in COMPETITIONS
}

/**
 * Resolve the active competition from the request host + the division cookie:
 * - `football.*` → football; `basketball.*` → basketball (men default, women via cookie)
 * - no sport subdomain (localhost, *.vercel.app) → cookie, falling back to football
 */
export function resolveCompetition(host: string | null | undefined, cookieValue?: string | null): Competition {
  const sub = (host ?? '').split('.')[0].toLowerCase()
  const cookieKey = isCompetitionKey(cookieValue) ? cookieValue : undefined

  if (sub === 'basketball') {
    return cookieKey === 'basketball_women' ? COMPETITIONS.basketball_women : COMPETITIONS.basketball_men
  }
  if (sub === 'football') return COMPETITIONS.football
  if (cookieKey) return COMPETITIONS[cookieKey]
  return COMPETITIONS[DEFAULT_COMPETITION]
}
