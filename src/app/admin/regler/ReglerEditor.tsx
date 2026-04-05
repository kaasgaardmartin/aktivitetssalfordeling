'use client'

import { useState } from 'react'

export default function ReglerEditor({ regler }: { regler: any }) {
  const [innhold, setInnhold] = useState(regler?.innhold ?? '')
  const [lagrer, setLagrer] = useState(false)
  const [lagret, setLagret] = useState(false)

  async function lagre() {
    setLagrer(true)
    const res = await fetch('/api/admin/regler', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: regler.id, innhold }),
    })
    if (res.ok) { setLagret(true); setTimeout(() => setLagret(false), 3000) }
    setLagrer(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 flex h-13 items-center justify-between border-b border-gray-200 bg-white px-5">
        <div className="flex items-center gap-3">
          <a href="/admin" className="text-sm text-gray-600 hover:text-gray-800">← Admin</a>
          <span className="h-4 w-px bg-gray-200" />
          <span className="text-sm font-semibold text-gray-900">Regler og info</span>
        </div>
        <div className="flex items-center gap-3">
          {lagret && <span className="text-sm text-green-600">✓ Lagret</span>}
          <button onClick={lagre} disabled={lagrer} className="btn-primary text-sm">
            {lagrer ? 'Lagrer...' : 'Lagre'}
          </button>
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-3">
        <p className="text-sm text-gray-600">
          Teksten vises for alle klubber under "Regler og info". Bruk tomme linjer for å skille seksjoner.
        </p>
        <textarea
          className="input h-[calc(100vh-200px)] resize-none font-mono text-sm leading-relaxed"
          value={innhold}
          onChange={e => setInnhold(e.target.value)}
          placeholder="Skriv inn regler og retningslinjer her..."
        />
        {regler?.oppdatert_at && (
          <p className="text-xs text-gray-500">
            Sist oppdatert: {new Date(regler.oppdatert_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}
