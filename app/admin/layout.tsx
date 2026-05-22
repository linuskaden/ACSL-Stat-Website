import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ACSL Admin',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
