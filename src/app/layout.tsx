import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aktivitetssalfordeling — Oslo kampidrett',
  description: 'System for fordeling av treningstid i kampidrettssaler i Oslo',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
