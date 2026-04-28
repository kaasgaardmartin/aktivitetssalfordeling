'use client'

import { useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const OversiktKart = dynamic(() => import('./OversiktKart'), {
  ssr: false,
  loading: () => (
    <div className="card flex items-center justify-center" style={{ height: '360px' }}>
      <p className="text-sm text-gray-500">Laster kart…</p>
    </div>
  ),
})

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

const IDRETT_COLORS: Record<string, string> = {
  kickboksing: 'bg-blue-100 text-blue-900',
  boksing: 'bg-amber-100 text-amber-900',
  kampsport: 'bg-purple-100 text-purple-900',
  judo: 'bg-green-100 text-green-900',
  bryting: 'bg-orange-100 text-orange-900',
  fekting: 'bg-teal-100 text-teal-900',
}

function idrettColor(idrett?: string | null) {
  const key = (idrett ?? '').toLowerCase()
  return Object.entries(IDRETT_COLORS).find(([k]) => key.includes(k))?.[1] ?? 'bg-gray-100 text-gray-900'
}
function fmt(t?: string | null) { return t?.slice(0, 5) ?? '' }

export default function OversiktClient({ haller, slots, sesong }: { haller: Hall[]; slots: Slot[]; sesong: Sesong | null }) {
  const [selectedHal, setSelectedHal] = useState<string>(haller[0]?.id ?? '')
  const fordelingRef = useRef<HTMLDivElement>(null)

  const halSlots = useMemo(() => slots.filter(s => s.hal_id === selectedHal), [slots, selectedHal])
  const valgtHall = haller.find(h => h.id === selectedHal)

  function velgHall(id: string) {
    setSelectedHal(id)
    setTimeout(() => {
      fordelingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Aktivitetssaler Oslo — offentlig oversikt</h1>
            <p className="text-xs text-gray-600">
              {sesong ? (
                <>Sesong: <strong>{sesong.navn}</strong>{sesong.laast && <span className="ml-2 text-red-700">🔒 Tildelingen er låst</span>}</>
              ) : 'Ingen aktiv sesong'}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 space-y-4">
        {!sesong ? (
          <div className="card p-6 text-center text-sm text-gray-600">Ingen aktiv sesong — fordelingen er ikke publisert.</div>
        ) : (
          <>
            {/* Kart */}
            <div>
              <p className="text-[10px] text-gray-500 mb-2">Klikk på en sal i kartet for å se fordelingen</p>
              <OversiktKart haller={haller} onSelectHal={velgHall} />
            </div>

            {/* Fordeling */}
            <div ref={fordelingRef} className="scroll-mt-4 space-y-3">
              {/* Hall-velger */}
              <div className="flex flex-wrap gap-2">
                {haller.map(h => (
                  <button
                    key={h.id}
                    onClick={() => velgHall(h.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${selectedHal === h.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    {h.navn}
                  </button>
                ))}
              </div>

              {valgtHall && (
                <div className="card overflow-hidden">
                  {/* Hall-header */}
                  <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                    <p className="text-sm font-semibold text-gray-900">{valgtHall.navn}</p>
                    {valgtHall.adresse && (
                      <p className="text-[10px] text-gray-600">
                        {valgtHall.adresse}{valgtHall.poststed ? `, ${valgtHall.poststed}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Grid — samme stil som admin */}
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[400px]" style={{ gridTemplateColumns: '52px repeat(5, 1fr)' }}>
                      {/* Header-rad */}
                      <div className="border-b border-r border-gray-300 bg-gray-100 p-2" />
                      {UKEDAG_ORDER.map(d => (
                        <div key={d} className="border-b border-r border-gray-300 bg-gray-100 px-2 py-2 text-center text-xs font-bold uppercase tracking-wider text-gray-800 last:border-r-0">
                          {UKEDAG_SHORT[d]}
                        </div>
                      ))}

                      {/* Tidsrader */}
                      {TIME_ROWS.map(time => (
                        <div key={time} className="contents">
                          {/* Tidslabel */}
                          <div className="border-b border-r border-gray-300 bg-gray-100 px-2 flex items-center">
                            <span className="text-[10px] font-mono font-semibold text-gray-800">{time}</span>
                          </div>
                          {UKEDAG_ORDER.map(dag => {
                            const slot = halSlots.find(s => s.ukedag === dag && fmt(s.fra_kl) === time)
                            const isUtilgj = slot?.status === 'utilgjengelig'
                            const harKlubb = !!slot?.klubb_id && !isUtilgj
                            const idrett = slot?.idrett ?? slot?.klubber?.idrett ?? null

                            if (isUtilgj) {
                              return (
                                <div key={dag} className="h-9 border-b border-r border-gray-300 last:border-r-0 bg-gray-200 flex items-center justify-center">
                                  <span className="text-[9px] font-bold uppercase tracking-tight text-gray-500">×</span>
                                </div>
                              )
                            }
                            if (harKlubb) {
                              return (
                                <div key={dag} className={`h-9 border-b border-r border-gray-300 last:border-r-0 flex items-center px-1.5 overflow-hidden ${idrettColor(idrett)}`}>
                                  <span className="truncate text-[10px] font-semibold">{slot!.klubber?.navn ?? ''}</span>
                                </div>
                              )
                            }
                            // Ledig (enten ingen slot-rad, eller slot uten klubb)
                            return (
                              <div key={dag} className="h-9 border-b border-r border-gray-300 last:border-r-0 flex items-center justify-center bg-white">
                                <span className="text-[9px] text-green-700 font-medium">Ledig</span>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Forklaring */}
                  <div className="flex gap-3 flex-wrap border-t border-gray-300 bg-gray-100 px-4 py-2">
                    {Object.entries(IDRETT_COLORS).map(([k, cls]) => (
                      <span key={k} className="flex items-center gap-1 text-[10px] font-medium text-gray-800">
                        <span className={`h-2.5 w-2.5 rounded-sm ${cls}`} />
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </span>
                    ))}
                    <span className="flex items-center gap-1 text-[10px] font-medium text-gray-800">
                      <span className="h-2.5 w-2.5 rounded-sm bg-white ring-1 ring-gray-400" />Ledig
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-medium text-gray-800">
                      <span className="h-2.5 w-2.5 rounded-sm bg-gray-200" />Ikke tilgjengelig
                    </span>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[10px] text-gray-500 text-center pt-2">
              Dette er en offentlig oversikt. Klubber logger inn via lenken de har fått på e-post.
              Oppdateres automatisk hvert minutt.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
