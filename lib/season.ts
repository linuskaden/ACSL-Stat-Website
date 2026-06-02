import { cookies } from 'next/headers'

export const SEASON_COOKIE = 'acsl-season'
export const DEFAULT_SEASON = 2026

/**
 * Reads the currently selected season from the `acsl-season` cookie.
 * Falls back to DEFAULT_SEASON when the cookie is missing or invalid.
 *
 * Calling this in a Server Component opts the route into dynamic rendering
 * (cookies() is a request-time API), so each request reflects the chosen season.
 */
export async function getSelectedSeason(): Promise<number> {
  const store = await cookies()
  const raw = store.get(SEASON_COOKIE)?.value
  const n = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(n) ? n : DEFAULT_SEASON
}
