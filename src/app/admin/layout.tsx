import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Admin — Aktivitetssalfordeling' }
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
