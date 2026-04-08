'use client'

import { useEffect, useState } from 'react'

interface AuditEntry {
  id: string
  tidsstempel: string
  admin_epost: string | null
  handling: string
  entitet: string | null
  entitet_id: string | null
  beskrivelse: string | null
  metadata: any
}

const HANDLING_LABELS: Record<string, { label: string; color: string }> = {
  endring_godkjent: { label: 'Endring godkjent', color: 'bg-green-100 text-green-900 ring-1 ring-green-300' },
  endring_avslatt: { label: 'Endring avslått', color: 'bg-red-100 text-red-900 ring-1 ring-red-300' },
  soknad_godkjent: { label: 'Søknad godkjent', color: 'bg-green-100 text-green-900 ring-1 ring-green-300' },
  soknad_avslatt: { label: 'Søknad avslått', color: 'bg-red-100 text-red-900 ring-1 ring-red-300' },
  hall_opprettet: { label: 'Hall opprettet', color: 'bg-blue-100 text-blue-900 ring-1 ring-blue-300' },
  hall_oppdatert: { label: 'Hall oppdatert', color: 'bg-blue-100 text-blue-900 ring-1 ring-blue-300' },
  hall_slettet: { label: 'Hall slettet', color: 'bg-red-100 text-red-900 ring-1 ring-red-300' },
}

function badge(handling: string) {
  return HANDLING_LABELS[handling] ?? { label: handling, color: 'bg-gray-200 text-gray-900 ring-1 ring-gray-400' }
}

function formatDate(t: string) {
  return new Date(t).toLocaleString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('alle')

  useEffect(() => {
    fetch('/api/admin/audit?limit=200')
      .then(r => r.ok ? r.json() : [])
      .then(d => { setEntries(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = filter === 'alle' ? entries : entries.filter(e => e.handling === filter)
  const handlingsTyper = Array.from(new Set(entries.map(e => e.handling)))

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 space-y-4">
      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <span className="label">Filter</span>
        <button onClick={() => setFilter('alle')} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filter === 'alle' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          Alle
        </button>
        {handlingsTyper.map(h => (
          <button key={h} onClick={() => setFilter(h)} className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${filter === h ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {badge(h).label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-600">{filtered.length} oppføringer</span>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-gray-600">Laster logg…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-gray-600">Ingen oppføringer</div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {filtered.map(e => {
              const b = badge(e.handling)
              return (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge ${b.color}`}>{b.label}</span>
                        <span className="text-xs text-gray-600">{formatDate(e.tidsstempel)}</span>
                        {e.admin_epost && <span className="text-xs text-gray-600">· {e.admin_epost}</span>}
                      </div>
                      {e.beskrivelse && (
                        <p className="mt-1 text-sm text-gray-900">{e.beskrivelse}</p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
