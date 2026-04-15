'use client'

import { useEffect, useState } from 'react'

interface Registrering {
  id: string
  navn: string
  idrett: string | null
  epost: string
  kontaktperson: string | null
  telefon: string | null
  organisasjonsnummer: string | null
  beskrivelse: string | null
  status: 'ny' | 'godkjent' | 'avvist'
  notat_admin: string | null
  opprettet_at: string
  behandlet_at: string | null
}

export default function RegistreringerTab() {
  const [items, setItems] = useState<Registrering[]>([])
  const [laster, setLaster] = useState(true)
  const [filter, setFilter] = useState<'ny' | 'alle'>('ny')
  const [behandler, setBehandler] = useState<string | null>(null)
  const [notat, setNotat] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/klubb/registrer')
      .then(r => r.json())
      .then((d: any) => Array.isArray(d) ? setItems(d) : setItems([]))
      .finally(() => setLaster(false))
  }, [])

  async function behandle(id: string, status: 'godkjent' | 'avvist') {
    if (!confirm(status === 'godkjent' ? 'Godkjenn søknaden og opprett klubb?' : 'Avvis søknaden?')) return
    setBehandler(id)
    try {
      const res = await fetch('/api/klubb/registrer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, notat: notat[id] || undefined }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(`Feil: ${d.error ?? res.statusText}`)
        return
      }
      setItems(prev => prev.map(r => r.id === id ? { ...r, status, behandlet_at: new Date().toISOString(), notat_admin: notat[id] || null } : r))
    } finally {
      setBehandler(null)
    }
  }

  const visible = filter === 'ny' ? items.filter(i => i.status === 'ny') : items

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Søknader om tilgang</h2>
        <div className="flex gap-2 text-xs">
          <button onClick={() => setFilter('ny')} className={`btn ${filter === 'ny' ? 'bg-gray-900 text-white' : ''}`}>Nye ({items.filter(i => i.status === 'ny').length})</button>
          <button onClick={() => setFilter('alle')} className={`btn ${filter === 'alle' ? 'bg-gray-900 text-white' : ''}`}>Alle</button>
        </div>
      </div>

      {laster ? (
        <p className="text-sm text-gray-600 text-center py-8">Laster…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-600 text-center py-8">Ingen {filter === 'ny' ? 'nye søknader' : 'søknader'}.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <div key={r.id} className="card p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{r.navn}</p>
                  <p className="text-xs text-gray-600">{r.idrett}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  r.status === 'ny' ? 'bg-amber-100 text-amber-900' :
                  r.status === 'godkjent' ? 'bg-green-100 text-green-900' :
                  'bg-red-100 text-red-900'
                }`}>{r.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                <div><span className="text-gray-500">E-post:</span> {r.epost}</div>
                {r.telefon && <div><span className="text-gray-500">Telefon:</span> {r.telefon}</div>}
                {r.kontaktperson && <div><span className="text-gray-500">Kontakt:</span> {r.kontaktperson}</div>}
                {r.organisasjonsnummer && <div><span className="text-gray-500">Org.nr:</span> {r.organisasjonsnummer}</div>}
              </div>
              {r.beskrivelse && (
                <p className="text-xs text-gray-700 bg-gray-50 rounded-lg p-2 whitespace-pre-line">{r.beskrivelse}</p>
              )}
              {r.notat_admin && (
                <p className="text-xs text-gray-700 italic border-l-2 border-gray-300 pl-2">Notat: {r.notat_admin}</p>
              )}
              {r.status === 'ny' && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <textarea
                    rows={2}
                    placeholder="Notat til søker (valgfritt)"
                    className="input text-xs"
                    value={notat[r.id] ?? ''}
                    onChange={e => setNotat(n => ({ ...n, [r.id]: e.target.value }))}
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => behandle(r.id, 'avvist')} disabled={behandler === r.id} className="btn text-xs">Avvis</button>
                    <button onClick={() => behandle(r.id, 'godkjent')} disabled={behandler === r.id} className="btn-primary text-xs">Godkjenn og opprett klubb</button>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-gray-500">Mottatt {new Date(r.opprettet_at).toLocaleString('nb-NO')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
