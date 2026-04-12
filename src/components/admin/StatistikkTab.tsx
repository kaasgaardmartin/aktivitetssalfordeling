'use client'

import { useMemo } from 'react'
import type { Klubb, Slot } from './types'
import { idrettColor } from './types'

interface Props {
  klubber: Klubb[]
  slots: Slot[]
}

export default function StatistikkTab({ klubber, slots }: Props) {
  const data = useMemo(() => {
    // Per-klubb stats
    const klubbStats = klubber
      .filter(k => k.medlemstall && k.medlemstall > 0)
      .map(k => {
        const timer = slots.filter(s => s.klubb_id === k.id).length * 0.5
        const barn = k.ant_0_5 + k.ant_6_12 + k.ant_13_19
        return {
          ...k,
          timer,
          barn,
          voksne: k.ant_20_25 + k.ant_26_pluss,
          timerPerMedlem: timer / (k.medlemstall || 1),
        }
      })
      .sort((a, b) => b.timerPerMedlem - a.timerPerMedlem)

    // Per-idrett stats
    const idrettMap = new Map<string, { idrett: string; medlemmer: number; timer: number; barn: number; klubber: number }>()
    for (const k of klubbStats) {
      const idrett = k.idrett ?? 'Ukjent'
      // Støtte for komma-separert idrett (f.eks. "Kickboksing, Boksing")
      const idretter = idrett.split(',').map(s => s.trim())
      for (const i of idretter) {
        const existing = idrettMap.get(i) ?? { idrett: i, medlemmer: 0, timer: 0, barn: 0, klubber: 0 }
        existing.medlemmer += k.medlemstall ?? 0
        existing.timer += k.timer
        existing.barn += k.barn
        existing.klubber += 1
        idrettMap.set(i, existing)
      }
    }
    const idrettStats = [...idrettMap.values()]
      .map(i => ({ ...i, timerPerMedlem: i.timer / (i.medlemmer || 1) }))
      .sort((a, b) => b.timerPerMedlem - a.timerPerMedlem)

    // Totals
    const totalMedlemmer = klubbStats.reduce((s, k) => s + (k.medlemstall ?? 0), 0)
    const totalTimer = klubbStats.reduce((s, k) => s + k.timer, 0)

    return { klubbStats, idrettStats, totalMedlemmer, totalTimer }
  }, [klubber, slots])

  const { klubbStats, idrettStats, totalMedlemmer, totalTimer } = data
  const maxTimerPerMedlem = Math.max(...klubbStats.map(k => k.timerPerMedlem), 0.01)

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 space-y-6">
      {/* Sammendrag */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { val: klubbStats.length, lbl: 'Klubber med data' },
          { val: totalMedlemmer.toLocaleString('nb-NO'), lbl: 'Utøvere totalt' },
          { val: `${totalTimer.toFixed(0)}t`, lbl: 'Timer/uke totalt' },
          { val: totalMedlemmer > 0 ? `${(totalTimer / totalMedlemmer).toFixed(3)}t` : '–', lbl: 'Snitt timer/utøver' },
        ].map(s => (
          <div key={s.lbl} className="card px-4 py-3">
            <p className="text-xl font-semibold tabular-nums text-gray-900">{s.val}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{s.lbl}</p>
          </div>
        ))}
      </div>

      {/* Timer per utøver — per klubb */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-900">Timer per utøver — per klubb</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Sortert etter timer/medlem (høyest først)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Klubb</th>
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Idrett</th>
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600 text-right">Medl.</th>
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600 text-right">Barn 0–19</th>
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600 text-right">Timer/uke</th>
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600 text-right w-20">t/utøver</th>
                <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600 w-40 hidden sm:table-cell">Fordeling</th>
              </tr>
            </thead>
            <tbody>
              {klubbStats.map(k => {
                const barPct = (k.timerPerMedlem / maxTimerPerMedlem) * 100
                const avgTimerPerMedlem = totalTimer / totalMedlemmer
                const isAbove = k.timerPerMedlem > avgTimerPerMedlem * 1.5
                const isBelow = k.timerPerMedlem < avgTimerPerMedlem * 0.5
                return (
                  <tr key={k.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{k.navn}</td>
                    <td className="px-4 py-2">
                      {k.idrett && <span className={`badge text-[10px] ${idrettColor(k.idrett)}`}>{k.idrett}</span>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{k.medlemstall?.toLocaleString('nb-NO')}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{k.barn}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-semibold text-gray-900">{k.timer > 0 ? `${k.timer}t` : '–'}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-bold ${isAbove ? 'text-green-700' : isBelow ? 'text-red-600' : 'text-gray-900'}`}>
                      {k.timerPerMedlem.toFixed(3)}
                    </td>
                    <td className="px-4 py-2 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isAbove ? 'bg-green-500' : isBelow ? 'bg-red-400' : 'bg-blue-500'}`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-[10px] text-gray-500">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 mr-1 align-middle" /> Over 1,5× snitt
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mr-1 ml-3 align-middle" /> Rundt snitt
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400 mr-1 ml-3 align-middle" /> Under 0,5× snitt
        </div>
      </div>

      {/* Per idrett */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-900">Fordeling per idrett</p>
        </div>
        <div className="divide-y divide-gray-100">
          {idrettStats.map(i => {
            const medlemPct = totalMedlemmer > 0 ? (i.medlemmer / totalMedlemmer) * 100 : 0
            const timerPct = totalTimer > 0 ? (i.timer / totalTimer) * 100 : 0
            return (
              <div key={i.idrett} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`badge text-[10px] ${idrettColor(i.idrett)}`}>{i.idrett}</span>
                    <span className="text-[10px] text-gray-500">{i.klubber} {i.klubber === 1 ? 'klubb' : 'klubber'}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-gray-900">{i.timerPerMedlem.toFixed(3)} t/utøver</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Andel utøvere</span>
                      <span className="font-semibold tabular-nums">{medlemPct.toFixed(1)}% ({i.medlemmer.toLocaleString('nb-NO')})</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gray-500 rounded-full" style={{ width: `${medlemPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-600">Andel timer</span>
                      <span className="font-semibold tabular-nums">{timerPct.toFixed(1)}% ({i.timer}t)</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${timerPct > medlemPct * 1.3 ? 'bg-green-500' : timerPct < medlemPct * 0.7 ? 'bg-red-400' : 'bg-blue-500'}`} style={{ width: `${timerPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fordelingsbalanse — visuell */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-900">Fordelingsbalanse</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Andel av totale medlemmer vs. andel av totale timer — bør ligge nær hverandre</p>
        </div>
        <div className="px-4 py-3 space-y-2.5">
          {klubbStats.map(k => {
            const medlemPct = totalMedlemmer > 0 ? ((k.medlemstall ?? 0) / totalMedlemmer) * 100 : 0
            const timerPct = totalTimer > 0 ? (k.timer / totalTimer) * 100 : 0
            return (
              <div key={k.id} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-gray-900 truncate max-w-[200px]">{k.navn}</span>
                  <span className="text-gray-500 tabular-nums shrink-0 ml-2">
                    {medlemPct.toFixed(1)}% medl. / {timerPct.toFixed(1)}% timer
                  </span>
                </div>
                <div className="relative h-4">
                  {/* Medlemmer-bar */}
                  <div className="absolute inset-y-0 left-0 h-2 top-0 bg-gray-300 rounded-full" style={{ width: `${Math.min(medlemPct * 3, 100)}%` }} />
                  {/* Timer-bar */}
                  <div className={`absolute inset-y-0 left-0 h-2 top-2 rounded-full ${timerPct > medlemPct * 1.5 ? 'bg-green-500' : timerPct < medlemPct * 0.5 ? 'bg-red-400' : 'bg-blue-500'}`} style={{ width: `${Math.min(timerPct * 3, 100)}%` }} />
                </div>
              </div>
            )
          })}
          <div className="flex items-center gap-4 text-[10px] text-gray-500 pt-2 border-t border-gray-100">
            <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300 mr-1 align-middle" /> Andel medlemmer</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 mr-1 align-middle" /> Andel timer</span>
          </div>
        </div>
      </div>

      {/* Aldersprofil */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-900">Aldersprofil per klubb</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Viser sammensetning — sier ikke noe om hvem som bruker de tildelte timene</p>
        </div>
        <div className="px-4 py-3 space-y-3">
          {klubbStats.map(k => {
            const total = k.medlemstall ?? 1
            const segments = [
              { label: '0–5', val: k.ant_0_5, color: 'bg-blue-300' },
              { label: '6–12', val: k.ant_6_12, color: 'bg-blue-500' },
              { label: '13–19', val: k.ant_13_19, color: 'bg-indigo-500' },
              { label: '20–25', val: k.ant_20_25, color: 'bg-purple-400' },
              { label: '26+', val: k.ant_26_pluss, color: 'bg-gray-400' },
            ]
            return (
              <div key={k.id}>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="font-medium text-gray-900">{k.navn}</span>
                  <span className="text-gray-500 tabular-nums">{k.barn} barn / {k.voksne} voksne ({Math.round((k.barn / total) * 100)}% barn)</span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden">
                  {segments.map(s => s.val > 0 ? (
                    <div
                      key={s.label}
                      className={`${s.color} transition-all`}
                      style={{ width: `${(s.val / total) * 100}%` }}
                      title={`${s.label}: ${s.val} (${Math.round((s.val / total) * 100)}%)`}
                    />
                  ) : null)}
                </div>
              </div>
            )
          })}
          <div className="flex items-center gap-3 text-[10px] text-gray-500 pt-2 border-t border-gray-100">
            {[
              { label: '0–5', color: 'bg-blue-300' },
              { label: '6–12', color: 'bg-blue-500' },
              { label: '13–19', color: 'bg-indigo-500' },
              { label: '20–25', color: 'bg-purple-400' },
              { label: '26+', color: 'bg-gray-400' },
            ].map(s => (
              <span key={s.label}><span className={`inline-block w-2.5 h-2.5 rounded-full ${s.color} mr-0.5 align-middle`} /> {s.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
