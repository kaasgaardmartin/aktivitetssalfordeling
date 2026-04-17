'use client'

const TIME_ROWS = ['15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30']
const GRID_DAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag'] as const
const DAG_LABEL: Record<string, string> = { mandag: 'Mandag', tirsdag: 'Tirsdag', onsdag: 'Onsdag', torsdag: 'Torsdag', fredag: 'Fredag' }

function fmt(t: string) { return t.slice(0, 5) }

interface Slot {
  id: string
  hal_id: string
  ukedag: string
  fra_kl: string
  til_kl: string
  klubb_id: string | null
  status: string | null
  haller: { id: string; navn: string; adresse: string | null; poststed: string | null } | null
}

interface LedigPeriode {
  hal_id: string
  dag: string
  fra: string
  til: string
}

interface Sesong { id: string; navn: string; laast: boolean }

function beregnLedigePerioder(slots: Slot[]): Map<string, { hal: NonNullable<Slot['haller']>; perioder: LedigPeriode[] }> {
  const hallerMap = new Map<string, { hal: NonNullable<Slot['haller']>; perioder: LedigPeriode[] }>()

  // Samle alle unike haller
  for (const s of slots) {
    if (s.haller && !hallerMap.has(s.hal_id)) {
      hallerMap.set(s.hal_id, { hal: s.haller, perioder: [] })
    }
  }

  // For hver hall og dag: finn ledige tider og grupper sammenhengende
  for (const [halId, entry] of hallerMap) {
    const halSlots = slots.filter(s => s.hal_id === halId)
    for (const dag of GRID_DAYS) {
      const opptatt = new Set(
        halSlots
          .filter(s => s.ukedag === dag && (s.klubb_id || s.status === 'utilgjengelig'))
          .map(s => fmt(s.fra_kl))
      )
      const ledigeTider = TIME_ROWS.filter(t => !opptatt.has(t))

      let current: LedigPeriode | null = null
      for (const t of ledigeTider) {
        const [h, m] = t.split(':').map(Number)
        const tilMins = h * 60 + m + 30
        const til = `${String(Math.floor(tilMins / 60)).padStart(2, '0')}:${String(tilMins % 60).padStart(2, '0')}`

        if (current && current.til === t) {
          current.til = til
        } else {
          if (current) entry.perioder.push(current)
          current = { hal_id: halId, dag, fra: t, til }
        }
      }
      if (current) entry.perioder.push(current)
    }
  }

  return hallerMap
}

export default function LedigClient({ slots, sesong }: { slots: Slot[]; sesong: Sesong | null }) {
  const hallerMap = sesong ? beregnLedigePerioder(slots) : new Map()

  const hallerMedLedig = [...hallerMap.entries()]
    .map(([id, { hal, perioder }]) => ({ id, hal, perioder }))
    .filter(h => h.perioder.length > 0)
    .sort((a, b) => a.hal.navn.localeCompare(b.hal.navn))

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Ledige tider</h1>
            <p className="text-xs text-gray-500">
              {sesong ? <>Sesong: <strong>{sesong.navn}</strong></> : 'Ingen aktiv sesong'}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600">
            <a href="/oversikt" className="underline">Kart og full fordeling</a>
            <span>·</span>
            <a href="/" className="underline">← Forside</a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-5 space-y-3">
        {!sesong ? (
          <div className="card p-6 text-center text-sm text-gray-600">Ingen aktiv sesong.</div>
        ) : hallerMedLedig.length === 0 ? (
          <div className="card p-6 text-center text-sm text-gray-600">Ingen ledige tider for øyeblikket.</div>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              Oversikt over ledige treningstider per sal. Grønne perioder er tilgjengelige.
            </p>
            {hallerMedLedig.map(({ id, hal, perioder }) => {
              const dager = GRID_DAYS.filter(d => perioder.some(p => p.dag === d))
              return (
                <div key={id} className="card overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <p className="text-sm font-semibold text-gray-900">{hal.navn}</p>
                    {hal.adresse && (
                      <p className="text-[10px] text-gray-500">{hal.adresse}{hal.poststed ? `, ${hal.poststed}` : ''}</p>
                    )}
                  </div>
                  <div className="px-4 py-3 space-y-2.5">
                    {dager.map(dag => {
                      const dagPerioder = perioder.filter(p => p.dag === dag)
                      return (
                        <div key={dag} className="flex items-start gap-3">
                          <span className="w-16 shrink-0 text-xs font-medium text-gray-700 pt-0.5">{DAG_LABEL[dag]}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {dagPerioder.map(p => (
                              <span
                                key={`${p.dag}-${p.fra}`}
                                className="rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums bg-green-100 text-green-800 ring-1 ring-green-300"
                              >
                                {p.fra}–{p.til}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <p className="text-[10px] text-gray-400 text-center pt-1">
              Oppdateres automatisk hvert minutt ·{' '}
              <a href="/registrer" className="underline">Søk om tilgang som klubb</a>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
