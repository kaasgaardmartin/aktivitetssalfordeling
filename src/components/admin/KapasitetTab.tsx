'use client'

import type { Hall, Slot } from './types'
import { UKEDAG_ORDER, UKEDAG_SHORT, idrettColor, formatTime } from './types'

interface KapasitetTabProps {
  haller: Hall[]
  slots: Slot[]
}

export default function KapasitetTab({ haller, slots }: KapasitetTabProps) {
  // Beregn statistikk per hall
  const halData = haller.map(h => {
    const hSlots = slots.filter(s => s.hal_id === h.id)
    const total = hSlots.length
    const tildelt = hSlots.filter(s => s.klubb_id && s.status !== 'utilgjengelig').length
    const ledig = hSlots.filter(s => !s.klubb_id && s.status !== 'utilgjengelig').length
    const utilgjengelig = hSlots.filter(s => s.status === 'utilgjengelig').length

    // Per ukedag
    const perDag = UKEDAG_ORDER.map(dag => {
      const dagSlots = hSlots.filter(s => s.ukedag === dag)
      return {
        dag,
        total: dagSlots.length,
        tildelt: dagSlots.filter(s => s.klubb_id && s.status !== 'utilgjengelig').length,
        ledig: dagSlots.filter(s => !s.klubb_id && s.status !== 'utilgjengelig').length,
        utilgjengelig: dagSlots.filter(s => s.status === 'utilgjengelig').length,
      }
    })

    // Klubber i denne hallen
    const klubbMap = new Map<string, { navn: string; idrett: string | null; antall: number }>()
    hSlots.filter(s => s.klubb_id && s.klubber).forEach(s => {
      const k = klubbMap.get(s.klubb_id!)
      if (k) k.antall++
      else klubbMap.set(s.klubb_id!, { navn: s.klubber!.navn, idrett: s.klubber!.idrett, antall: 1 })
    })

    return { hall: h, total, tildelt, ledig, utilgjengelig, perDag, klubber: [...klubbMap.values()].sort((a, b) => b.antall - a.antall) }
  })

  // Totaler
  const totalSlots = halData.reduce((s, h) => s + h.total, 0)
  const totalTildelt = halData.reduce((s, h) => s + h.tildelt, 0)
  const totalLedig = halData.reduce((s, h) => s + h.ledig, 0)
  const totalUtilgj = halData.reduce((s, h) => s + h.utilgjengelig, 0)

  // Per ukedag totalt
  const totalPerDag = UKEDAG_ORDER.map(dag => ({
    dag,
    total: halData.reduce((s, h) => s + (h.perDag.find(d => d.dag === dag)?.total ?? 0), 0),
    tildelt: halData.reduce((s, h) => s + (h.perDag.find(d => d.dag === dag)?.tildelt ?? 0), 0),
    ledig: halData.reduce((s, h) => s + (h.perDag.find(d => d.dag === dag)?.ledig ?? 0), 0),
    utilgjengelig: halData.reduce((s, h) => s + (h.perDag.find(d => d.dag === dag)?.utilgjengelig ?? 0), 0),
  }))

  function timer(n: number) {
    return `${(n * 0.5).toFixed(1).replace('.0', '')}t`
  }

  function pct(n: number, total: number) {
    if (total === 0) return '0'
    return `${Math.round((n / total) * 100)}%`
  }

  return (
    <div className="p-3 md:p-5 space-y-6 max-w-6xl">
      {/* Samlet oversikt */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Samlet kapasitet</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="card px-3 py-2.5">
            <p className="text-xl font-semibold tabular-nums text-gray-900">{timer(totalSlots)}</p>
            <p className="text-[10px] text-gray-600">Totalt per uke</p>
          </div>
          <div className="card px-3 py-2.5">
            <p className="text-xl font-semibold tabular-nums text-blue-700">{timer(totalTildelt)}</p>
            <p className="text-[10px] text-gray-600">Tildelt ({pct(totalTildelt, totalSlots)})</p>
          </div>
          <div className="card px-3 py-2.5">
            <p className="text-xl font-semibold tabular-nums text-green-700">{timer(totalLedig)}</p>
            <p className="text-[10px] text-gray-600">Ledig ({pct(totalLedig, totalSlots)})</p>
          </div>
          <div className="card px-3 py-2.5">
            <p className="text-xl font-semibold tabular-nums text-gray-500">{timer(totalUtilgj)}</p>
            <p className="text-[10px] text-gray-600">Utilgjengelig ({pct(totalUtilgj, totalSlots)})</p>
          </div>
        </div>
      </div>

      {/* Per ukedag */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Per ukedag (alle haller)</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="text-left px-3 py-2 font-semibold text-gray-800">Dag</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-800">Totalt</th>
                <th className="text-right px-3 py-2 font-semibold text-blue-800">Tildelt</th>
                <th className="text-right px-3 py-2 font-semibold text-green-800">Ledig</th>
                <th className="text-right px-3 py-2 font-semibold text-gray-600">Utilgj.</th>
                <th className="px-3 py-2 w-40">Utnyttelse</th>
              </tr>
            </thead>
            <tbody>
              {totalPerDag.map(d => (
                <tr key={d.dag} className="border-b border-gray-200 last:border-b-0">
                  <td className="px-3 py-2 font-medium text-gray-900">{d.dag.charAt(0).toUpperCase() + d.dag.slice(1)}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-gray-900">{timer(d.total)}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-blue-700">{timer(d.tildelt)}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-green-700">{timer(d.ledig)}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-gray-500">{timer(d.utilgjengelig)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full flex">
                          <div className="bg-blue-500 h-full" style={{ width: pct(d.tildelt, d.total) }} />
                          <div className="bg-gray-400 h-full" style={{ width: pct(d.utilgjengelig, d.total) }} />
                        </div>
                      </div>
                      <span className="text-[10px] tabular-nums text-gray-600 w-8 text-right">{pct(d.tildelt, d.total - d.utilgjengelig)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per hall */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Per hall</h2>
        <div className="space-y-3">
          {halData.map(h => (
            <div key={h.hall.id} className="card overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{h.hall.navn}</p>
                  <div className="flex gap-2 mt-0.5">
                    {h.hall.underlag && <span className="text-[10px] text-gray-600">{h.hall.underlag}</span>}
                    {h.hall.adresse && <span className="text-[10px] text-gray-500">{h.hall.adresse}</span>}
                  </div>
                </div>
                <div className="flex gap-3 text-right">
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-green-700">{timer(h.ledig)}</p>
                    <p className="text-[10px] text-gray-600">Ledig</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-blue-700">{timer(h.tildelt)}</p>
                    <p className="text-[10px] text-gray-600">Tildelt</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-gray-900">{timer(h.total)}</p>
                    <p className="text-[10px] text-gray-600">Totalt</p>
                  </div>
                </div>
              </div>

              {/* Ukedags-breakdown */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Dag</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Totalt</th>
                    <th className="text-right px-3 py-1.5 font-medium text-blue-700">Tildelt</th>
                    <th className="text-right px-3 py-1.5 font-medium text-green-700">Ledig</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-500">Utilgj.</th>
                    <th className="px-3 py-1.5 w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {h.perDag.filter(d => d.total > 0).map(d => (
                    <tr key={d.dag} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-3 py-1.5 text-gray-900">{UKEDAG_SHORT[d.dag]}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums">{timer(d.total)}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums text-blue-700">{timer(d.tildelt)}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums text-green-700">{timer(d.ledig)}</td>
                      <td className="text-right px-3 py-1.5 tabular-nums text-gray-500">{timer(d.utilgjengelig)}</td>
                      <td className="px-3 py-1.5">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full flex">
                            <div className="bg-blue-500 h-full" style={{ width: pct(d.tildelt, d.total) }} />
                            <div className="bg-gray-400 h-full" style={{ width: pct(d.utilgjengelig, d.total) }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Klubber i hallen */}
              {h.klubber.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Klubber</p>
                  <div className="flex flex-wrap gap-1.5">
                    {h.klubber.map(k => (
                      <span key={k.navn} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${idrettColor(k.idrett)}`}>
                        {k.navn} <span className="opacity-70">({timer(k.antall)})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
