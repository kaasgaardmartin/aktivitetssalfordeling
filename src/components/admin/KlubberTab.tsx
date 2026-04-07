'use client'

import { useState } from 'react'
import type { Klubb, Slot } from './types'
import { idrettColor, exportCSV } from './types'

interface Props {
  klubber: Klubb[]
  slots: Slot[]
}

export default function KlubberTab({ klubber, slots }: Props) {
  const [search, setSearch] = useState('')

  const filtered = klubber.filter(k =>
    !search ||
    k.navn.toLowerCase().includes(search.toLowerCase()) ||
    (k.idrett ?? '').toLowerCase().includes(search.toLowerCase())
  )

  function handleExport() {
    const headers = ['Klubb', 'Idrett', 'E-post', 'Medlemmer', 'Andel barn (%)', 'Timer/uke']
    const rows = filtered.map(k => {
      const timerPerUke = (slots.filter(s => s.klubb_id === k.id).length * 0.5)
      return [
        k.navn,
        k.idrett ?? '',
        k.epost,
        String(k.medlemstall ?? ''),
        k.andel_barn != null ? String(k.andel_barn) : '',
        String(timerPerUke),
      ]
    })
    exportCSV('klubber-oversikt.csv', headers, rows)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Registrerte klubber</h2>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn text-xs">Eksporter CSV</button>
          <input type="text" placeholder="Søk klubb..." className="input w-56 text-xs" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      {klubber.length === 0 ? (
        <p className="text-center text-sm text-gray-600 py-12">Ingen klubber registrert</p>
      ) : (
        <div className="card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Klubb</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Idrett</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 text-right">Medlemmer</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 text-right">Andel barn</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 text-right">Timer/uke</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 hidden sm:table-cell">E-post</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(k => {
                const timerPerUke = (slots.filter(s => s.klubb_id === k.id).length * 0.5)
                return (
                  <tr key={k.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold ${idrettColor(k.idrett)}`}>
                          {k.navn.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                        </div>
                        <span className="font-medium text-gray-900 text-xs">{k.navn}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {k.idrett && <span className={`badge text-[10px] ${idrettColor(k.idrett)}`}>{k.idrett}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-gray-700">{k.medlemstall ?? '–'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-gray-700">{k.andel_barn != null ? `${k.andel_barn}%` : '–'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs font-semibold text-gray-900">{timerPerUke > 0 ? `${timerPerUke}t` : '–'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600 truncate max-w-[180px] hidden sm:table-cell">{k.epost}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] text-gray-600">{klubber.length} klubber totalt</span>
            <span className="text-[10px] text-gray-600">{(slots.filter(s => s.klubb_id).length * 0.5).toFixed(0)}t tildelt totalt</span>
          </div>
        </div>
      )}
    </div>
  )
}
