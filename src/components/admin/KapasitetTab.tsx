'use client'

import type { Hall, Slot } from './types'
import { UKEDAG_ORDER, UKEDAG_SHORT, formatTime } from './types'

interface KapasitetTabProps {
  haller: Hall[]
  slots: Slot[]
}

export default function KapasitetTab({ haller, slots }: KapasitetTabProps) {
  // Beregn ledige slots per hall per ukedag
  const halData = haller
    .map(h => {
      const hSlots = slots.filter(s => s.hal_id === h.id)
      const perDag = UKEDAG_ORDER.map(dag => {
        const dagSlots = hSlots.filter(s => s.ukedag === dag)
        const ledige = dagSlots.filter(s => !s.klubb_id && s.status !== 'utilgjengelig')
        // Grupper sammenhengende ledige tider
        const sorted = ledige.sort((a, b) => a.fra_kl.localeCompare(b.fra_kl))
        const perioder: { fra: string; til: string }[] = []
        for (const s of sorted) {
          const last = perioder[perioder.length - 1]
          if (last && last.til === formatTime(s.fra_kl)) {
            last.til = formatTime(s.til_kl)
          } else {
            perioder.push({ fra: formatTime(s.fra_kl), til: formatTime(s.til_kl) })
          }
        }
        return { dag, ledig: ledige.length, perioder }
      })
      const totalLedig = perDag.reduce((s, d) => s + d.ledig, 0)
      return { hall: h, perDag, totalLedig }
    })
    .filter(h => h.totalLedig > 0)
    .sort((a, b) => b.totalLedig - a.totalLedig)

  const totalLedigTimer = halData.reduce((s, h) => s + h.totalLedig, 0)

  function timer(n: number) {
    return `${(n * 0.5).toFixed(1).replace('.0', '')}t`
  }

  return (
    <div className="p-3 md:p-5 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Ledig kapasitet</h2>
        <span className="text-sm font-semibold text-green-700">{timer(totalLedigTimer)} totalt ledig</span>
      </div>

      {halData.length === 0 && (
        <div className="card px-4 py-8 text-center">
          <p className="text-sm text-gray-600">Ingen ledig kapasitet</p>
        </div>
      )}

      {halData.map(h => {
        const dagerMedLedig = h.perDag.filter(d => d.ledig > 0)
        return (
          <div key={h.hall.id} className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{h.hall.navn}</p>
              <span className="text-sm font-semibold tabular-nums text-green-700">{timer(h.totalLedig)}</span>
            </div>
            <div className="px-4 py-2 space-y-1">
              {dagerMedLedig.map(d => (
                <div key={d.dag} className="flex items-center gap-3 text-xs">
                  <span className="w-8 font-medium text-gray-700">{UKEDAG_SHORT[d.dag]}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {d.perioder.map((p, i) => (
                      <span key={i} className="rounded bg-green-100 text-green-800 ring-1 ring-green-300 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">
                        {p.fra}–{p.til}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
