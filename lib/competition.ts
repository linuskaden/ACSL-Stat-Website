import { cookies, headers } from 'next/headers'

/* Multi-sport: the site serves several competitions from one codebase/DB.
   Teams (universities) are shared; rosters, games, standings and stats are
   scoped by competition_id. Football is the default so nothing changes until
   we wire the switcher and add basketball data. */

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

function isKey(v: unknown): v is CompetitionKey {
  return typeof v === 'string' && v in COMPETITIONS
}

/**
 * Resolve the active competition:
 * 1. Subdomain picks the sport (football.* → football, basketball.* → basketball).
 *    Within basketball the men/women division comes from the cookie (men default).
 * 2. Without a sport subdomain (localhost, vercel preview) the cookie decides,
 *    falling back to football.
 */
export async function getSelectedCompetition(): Promise<Competition> {
  let cookieKey: CompetitionKey | undefined
  try {
    const v = (await cookies()).get(COMPETITION_COOKIE)?.value
    if (isKey(v)) cookieKey = v
  } catch {}

  let host = ''
  try { host = (await headers()).get('host') ?? '' } catch {}
  const sub = host.split('.')[0].toLowerCase()

  if (sub === 'basketball') {
    return cookieKey === 'basketball_women' ? COMPETITIONS.basketball_women : COMPETITIONS.basketball_men
  }
  if (sub === 'football') return COMPETITIONS.football

  if (cookieKey) return COMPETITIONS[cookieKey]
  return COMPETITIONS[DEFAULT_COMPETITION]
}
