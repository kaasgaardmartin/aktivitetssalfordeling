'use client'

import type { VentelisteItem } from './types'

interface Props {
  venteliste: VentelisteItem[]
}

export default function VentelisteTab({ venteliste }: Props) {
  async function handleAction(id: string, status: 'tildelt' | 'inaktiv') {
    await fetch('/api/venteliste', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    window.location.reload()
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 space-y-3">
      {venteliste.length === 0 ? (
        <p className="text-center text-sm text-gray-600 py-12">Ingen klubber på venteliste</p>
      ) : venteliste.map((v) => (
        <div key={v.id} className="card p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm text-gray-900">{v.klubber?.navn}</p>
            <div className="flex gap-2 mt-1">
              {v.haller && <span className="badge bg-gray-100 text-gray-600">{v.haller.navn}</span>}
              {v.gruppe && <span className="badge bg-blue-50 text-blue-700">{v.gruppe.charAt(0).toUpperCase() + v.gruppe.slice(1)}</span>}
              <span className="text-xs text-gray-600">{new Date(v.meldt_dato).toLocaleDateString('nb-NO')}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => handleAction(v.id, 'tildelt')} className="btn-primary text-xs">Tildel plass</button>
            <button onClick={() => handleAction(v.id, 'inaktiv')} className="btn text-xs">Fjern</button>
          </div>
        </div>
      ))}
    </div>
  )
}
