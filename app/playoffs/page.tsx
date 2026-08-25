import { redirect } from 'next/navigation'

// Schedule + Playoffs are now one page with a sub-navigation.
export default function PlayoffsPage() {
  redirect('/schedule')
}
