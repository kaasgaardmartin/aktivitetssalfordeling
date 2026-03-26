'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoggInn() {
  const [passord, setPassord] = useState('')
  const [feil, setFeil] = useState('')
  const [laster, setLaster] = useState(false)
  const router = useRouter()

  async function loggInn(e: React.FormEvent) {
    e.preventDefault()
    setLaster(true)
    setFeil('')

    const res = await fetch('/api/admin/logg-inn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passord }),
    })

    if (res.ok) {
      router.push('/admin')
    } else {
      setFeil('Feil passord')
      setLaster(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900">
            <svg viewBox="0 0 16 16" className="h-6 w-6 fill-white"><path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" /></svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Admin-innlogging</h1>
          <p className="mt-1 text-sm text-gray-500">Oslo kampidrett</p>
        </div>

        <form onSubmit={loggInn} className="card p-6 space-y-4">
          <div>
            <label className="label mb-1.5">Passord</label>
            <input
              type="password"
              className="input"
              value={passord}
              onChange={e => setPassord(e.target.value)}
              placeholder="••••••••"
              required
              autoFocus
            />
          </div>
          {feil && <p className="text-sm text-red-600">{feil}</p>}
          <button type="submit" disabled={laster} className="btn-primary w-full">
            {laster ? 'Logger inn...' : 'Logg inn'}
          </button>
        </form>
      </div>
    </main>
  )
}
