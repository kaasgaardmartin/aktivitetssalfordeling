'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

const OversiktKart = dynamic(() => import('./OversiktKart'), {
  ssr: false,
  loading: () => <div className="card flex items-center justify-center" style={{height:'480px'}}><p className="text-sm text-gray-500">Laster kart…</p></div>
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
const UKEDAG_LABEL: Record<string, string> = { mandag: 'Mandag', tirsdag: 'Tirsdag', onsdag: 'Onsdag', torsdag: 'Torsdag', fredag: 'Fredag' }
const TIME_ROWS = ['15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30']

const IDRETT_COLORS: Record<string, string> = {
  kickboksing: 'bg-blue-100 text-blue-900',
  boksing: 'bg-amber-100 text-amber-900',
  kampsport: 'bg-purple-100 text-purple-900',
  judo: 'bg-green-100 text-green-900',
  bryting: 'bg-orange-100 text-orange-900',
  dans: 'bg-pink-100 text-pink-900',
  fekting: 'bg-teal-100 text-teal-900',
  bordtennis: 'bg-cyan-100 text-cyan-900',
}

function idrettColor(idrett?: string | null) {
  const key = (idrett ?? '').toLowerCase()
  return Object.entries(IDRETT_COLORS).find(([k]) => key.includes(k))?.[1] ?? 'bg-gray-100 text-gray-900'
}
function fmt(t?: string | null) { return t?.slice(0, 5) ?? '' }

export default function OversiktClient({ haller, slots, sesong }: { haller: Hall[]; slots: Slot[]; sesong: Sesong | null }) {
  const [selectedHal, setSelectedHal] = useState<string>(haller[0]?.id ?? '')
  const [visning, setVisning] = useState<'oversikt' | 'kart'>('oversikt')

  const halSlots = useMemo(() => slots.filter(s => s.hal_id === selectedHal), [slots, selectedHal])
  const totalTimer = useMemo(() => slots.filter(s => s.klubb_id).length * 0.5, [slots])
  const ledigeTimer = useMemo(() => slots.filter(s => !s.klubb_id && s.status !== 'utilgjengelig').length * 0.5, [slots])

  const valgtHall = haller.find(h => h.id === selectedHal)

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
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <a href="/" className="underline">← Forside</a>
            <span>·</span>
            <a href="/registrer" className="underline">Søk om tilgang som klubb</a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 space-y-4">
        {!sesong ? (
          <div className="card p-6 text-center text-sm text-gray-600">Ingen aktiv sesong — fordelingen er ikke publisert.</div>
        ) : (
          <>
            {/* Visningsvelger */}
            <div className="flex gap-2">
              <button
                onClick={() => setVisning('oversikt')}
                className={`text-xs px-3 py-1.5 rounded-lg border ${visning === 'oversikt' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                Fordeling
              </button>
              <button
                onClick={() => setVisning('kart')}
                className={`text-xs px-3 py-1.5 rounded-lg border ${visning === 'kart' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                Kart
              </button>
            </div>

            {visning === 'oversikt' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="card px-3 py-2"><p className="text-lg font-semibold">{haller.length}</p><p className="text-[10px] text-gray-600">Saler</p></div>
                  <div className="card px-3 py-2"><p className="text-lg font-semibold">{totalTimer}t</p><p className="text-[10px] text-gray-600">Tildelte timer/uke</p></div>
                  <div className="card px-3 py-2"><p className="text-lg font-semibold">{ledigeTimer}t</p><p className="text-[10px] text-gray-600">Ledige timer/uke</p></div>
                  <div className="card px-3 py-2"><p className="text-lg font-semibold">{new Set(slots.filter(s => s.klubb_id).map(s => s.klubb_id)).size}</p><p className="text-[10px] text-gray-600">Klubber med tid</p></div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {haller.map(h => (
                    <button
                      key={h.id}
                      onClick={() => setSelectedHal(h.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg border ${selectedHal === h.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {h.navn}
                    </button>
                  ))}
                </div>

                {valgtHall && (
                  <div className="card overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                      <p className="text-sm font-semibold text-gray-900">{valgtHall.navn}</p>
                      {valgtHall.adresse && <p className="text-[10px] text-gray-600">{valgtHall.adresse}{valgtHall.poststed ? `, ${valgtHall.poststed}` : ''}</p>}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-2 text-left text-[10px] font-semibold text-gray-600 sticky left-0 bg-gray-50 z-10">Tid</th>
                            {UKEDAG_ORDER.map(d => (
                              <th key={d} className="px-2 py-2 text-left text-[10px] font-semibold text-gray-600 min-w-[120px]">{UKEDAG_LABEL[d]}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {TIME_ROWS.map(time => (
                            <tr key={time} className="border-t border-gray-100">
                              <td className="px-2 py-1.5 text-[10px] font-mono text-gray-600 sticky left-0 bg-white">{time}</td>
                              {UKEDAG_ORDER.map(dag => {
                                const slot = halSlots.find(s => s.ukedag === dag && fmt(s.fra_kl) === time)
                                if (!slot) return <td key={dag} className="px-1.5 py-1.5 bg-green-50 text-green-800 text-[10px]">Ledig</td>
                                if (slot.status === 'utilgjengelig') return <td key={dag} className="px-1.5 py-1.5 bg-gray-200 text-gray-600 text-[10px]">Utilgj.</td>
                                if (slot.klubb_id && slot.klubber) {
                                  const idrett = slot.idrett ?? slot.klubber.idrett
                                  return (
                                    <td key={dag} className={`px-1.5 py-1.5 text-[11px] ${idrettColor(idrett)}`}>
                                      <div className="font-medium truncate">{slot.klubber.navn}</div>
                                      {idrett && <div className="text-[9px] opacity-75">{idrett}</div>}
                                    </td>
                                  )
                                }
                                return <td key={dag} className="px-1.5 py-1.5 bg-green-50 text-green-800 text-[10px]">Ledig</td>
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {visning === 'kart' && (
              <OversiktKart
                haller={haller}
                onSelectHal={(id) => { setSelectedHal(id); setVisning('oversikt') }}
              />
            )}

            <p className="text-[10px] text-gray-500 text-center pt-2">
              Dette er en offentlig oversikt. Klubber logger inn på <a href="/" className="underline">forsiden</a>.
              Oppdateres automatisk hvert minutt.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
