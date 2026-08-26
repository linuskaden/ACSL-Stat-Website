import { redirect } from 'next/navigation'

// The teams overview grid is gone — "Teams" is now a dropdown in the nav.
// A direct visit to /teams just goes home.
export default function TeamsIndexPage() {
  redirect('/')
}
