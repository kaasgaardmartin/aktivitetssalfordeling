'use client'

import { useMemo, useRef, useState } from 'react'

interface Hall {
  id: string
  navn: string
  adresse: string | null
  postnummer: string | null
  poststed: string | null
  lat: number | null
  lng: number | null
  kilde_url: string | null
}
interface Slot {
  id: string; hal_id: string; ukedag: string; fra_kl: string; til_kl: string
  klubb_id: string | null; idrett: string | null; status?: 'ledig' | 'utilgjengelig'
  klubber?: { id: string; navn: string; idrett: string | null } | null
}
interface Sesong { id: string; navn: string; frist: string; status: string; laast: boolean }

const UKEDAG_ORDER = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag'] as const
const UKEDAG_SHORT: Record<string, string> = { mandag: 'Man', tirsdag: 'Tir', onsdag: 'Ons', torsdag: 'Tor', fredag: 'Fre' }
const TIME_ROWS = ['15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30']

function fmt(t?: string | null) { return t?.slice(0, 5) ?? '' }

export default function OversiktClient({ haller, slots, sesong }: { haller: Hall[]; slots: Slot[]; sesong: Sesong | null }) {
  const [selectedHal, setSelectedHal] = useState<string>(haller[0]?.id ?? '')

  const halSlots = useMemo(() => slots.filter(s => s.hal_id === selectedHal), [slots, selectedHal])
  const valgtHall = haller.find(h => h.id === selectedHal)

  // Antall ledige timer for valgt hall
  const ledigeTimer = useMemo(() => {
    let count = 0
    for (const dag of UKEDAG_ORDER) {
      for (const time of TIME_ROWS) {
        const slot = halSlots.find(s => s.ukedag === dag && fmt(s.fra_kl) === time)
        if (!slot || (!slot.klubb_id && slot.status !== 'utilgjengelig')) count++
      }
    }
    return count * 0.5
  }, [halSlots])

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Ledige tider — aktivitetssaler Oslo</h1>
            <p className="text-xs text-gray-500">
              {sesong ? <>Sesong: <strong>{sesong.navn}</strong></> : 'Ingen aktiv sesong'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <a href="/" className="underline">← Forside</a>
            <span>·</span>
            <a href="/registrer" className="underline">Søk om tilgang</a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 space-y-4">
        {!sesong ? (
          <div className="card p-6 text-center text-sm text-gray-600">Ingen aktiv sesong — fordelingen er ikke publisert.</div>
        ) : (
          <>
            {/* Hall-velger */}
            <div className="flex flex-wrap gap-2">
              {haller.map(h => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHal(h.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${selectedHal === h.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {h.navn}
                </button>
              ))}
            </div>

            {valgtHall && (
              <div className="card overflow-hidden">
                {/* Hall-header */}
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{valgtHall.navn}</p>
                    {valgtHall.adresse && (
                      <p className="text-[10px] text-gray-500">
                        {valgtHall.adresse}{valgtHall.poststed ? `, ${valgtHall.poststed}` : ''}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-green-700">{ledigeTimer}t ledig/uke</span>
                </div>

                {/* Grid */}
                <div className="overflow-x-auto">
                  <div className="grid min-w-[400px]" style={{ gridTemplateColumns: '52px repeat(5, 1fr)' }}>
                    {/* Header */}
                    <div className="border-b border-r border-gray-300 bg-gray-100 p-2" />
                    {UKEDAG_ORDER.map(d => (
                      <div key={d} className="border-b border-r border-gray-300 bg-gray-100 px-2 py-2 text-center text-xs font-bold uppercase tracking-wider text-gray-800 last:border-r-0">
                        {UKEDAG_SHORT[d]}
                      </div>
                    ))}

                    {/* Tidsrader */}
                    {TIME_ROWS.map(time => (
                      <div key={time} className="contents">
                        <div className="border-b border-r border-gray-300 bg-gray-100 px-2 flex items-center">
                          <span className="text-[10px] font-mono font-semibold text-gray-800">{time}</span>
                        </div>
                        {UKEDAG_ORDER.map(dag => {
                          const slot = halSlots.find(s => s.ukedag === dag && fmt(s.fra_kl) === time)
                          const isUtilgj = slot?.status === 'utilgjengelig'
                          const harKlubb = !!slot?.klubb_id && !isUtilgj
                          const erLedig = !harKlubb && !isUtilgj

                          return (
                            <div key={dag} className={`h-9 border-b border-r border-gray-300 last:border-r-0 flex items-center justify-center
                              ${erLedig ? 'bg-green-50' : isUtilgj ? 'bg-gray-100' : 'bg-gray-50'}`}>
                              {erLedig && (
                                <span className="text-[10px] font-semibold text-green-700">Ledig</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Forklaring */}
                <div className="flex gap-4 border-t border-gray-300 bg-gray-100 px-4 py-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-gray-700">
                    <span className="h-2.5 w-2.5 rounded-sm bg-green-100 ring-1 ring-green-300" />Ledig
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-gray-700">
                    <span className="h-2.5 w-2.5 rounded-sm bg-gray-50 ring-1 ring-gray-300" />Opptatt
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-gray-700">
                    <span className="h-2.5 w-2.5 rounded-sm bg-gray-100 ring-1 ring-gray-300" />Ikke tilgjengelig
                  </span>
                </div>
              </div>
            )}

            <p className="text-[10px] text-gray-400 text-center pt-1">
              Offentlig oversikt · Klubber logger inn på <a href="/" className="underline">forsiden</a>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
