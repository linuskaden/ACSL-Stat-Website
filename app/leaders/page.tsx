import { redirect } from 'next/navigation'

// The stats hub now lives at /stats — keep /leaders working for old links.
export default function LeadersRedirect() {
  redirect('/stats')
}
