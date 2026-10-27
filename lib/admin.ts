// Who counts as an ACSL operator/admin. Kept separate from fan accounts:
// fans authenticate via magic-link too, so "authenticated" is NOT the same as
// "admin". Admin-only server actions check the session email against this set.
// Extend via the FANTASY_ADMIN_EMAILS env var (comma-separated) if needed.
const BUILTIN = ['admin@acsl.at']

export const ADMIN_EMAILS = new Set(
  [...BUILTIN, ...((process.env.FANTASY_ADMIN_EMAILS ?? '').split(','))]
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
)

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase())
}
