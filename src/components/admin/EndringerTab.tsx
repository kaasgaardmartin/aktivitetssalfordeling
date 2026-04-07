'use client'

import type { Endring } from './types'
import { idrettColor, formatTime, groupEndringer } from './types'

interface Props {
  endringer: Endring[]
  onHandleEndring: (ids: string[], action: 'godkjenn' | 'avslaa') => void
}

function formatUkedag(d: string) { return d ? d.charAt(0).toUpperCase() + d.slice(1) : '' }

function formatVarighet(fra: string, til: string) {
  const [fH, fM] = fra.slice(0, 5).split(':').map(Number)
  const [tH, tM] = til.slice(0, 5).split(':').map(Number)
  const min = (tH * 60 + tM) - (fH * 60 + fM)
  const t = min / 60
  if (Number.isInteger(t)) return `${t}t`
  return `${t.toFixed(1).replace('.', ',')}t`
}

export default function EndringerTab({ endringer, onHandleEndring }: Props) {
  const grupper = groupEndringer(endringer)

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 space-y-4">
      {grupper.length === 0 ? (
        <p className="text-center text-sm text-gray-600 py-12">Ingen endringsforespørsler å behandle</p>
      ) : grupper.map((g) => (
        <div key={g.endring_ids[0]} className="card overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${idrettColor(g.klubb_idrett)}`}>
                  {g.klubb_navn?.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{g.klubb_navn}</p>
                  <p className="text-[10px] text-gray-600">Sendt {new Date(g.tidsstempel).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              {g.endring_ids.length > 1 && (
                <span className="badge bg-gray-100 text-gray-600 shrink-0">{g.endring_ids.length} slots</span>
              )}
            </div>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Nåværende tid</p>
                <p className="text-sm font-medium text-gray-900">{g.hal_navn}</p>
                <p className="text-xs text-gray-600">
                  {formatUkedag(g.ukedag)} {formatTime(g.fra_kl)}–{formatTime(g.til_kl)} ({formatVarighet(g.fra_kl, g.til_kl)})
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-blue-400 mb-1">Ønsket endring</p>
                <p className="text-sm font-medium text-blue-900">
                  {formatUkedag(g.ny_ukedag || g.ukedag)}
                </p>
                <p className="text-xs text-blue-700">
                  {formatTime(g.ny_fra_kl || g.fra_kl)}–{formatTime(g.ny_til_kl || g.til_kl)} ({formatVarighet(g.ny_fra_kl || g.fra_kl, g.ny_til_kl || g.til_kl)})
                </p>
              </div>
            </div>
            {g.kommentar && (
              <p className="text-xs italic text-gray-600 bg-gray-50 rounded px-2 py-1">«{g.kommentar}»</p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => onHandleEndring(g.endring_ids, 'avslaa')} className="btn btn-danger text-xs px-3 py-1.5">Avslå</button>
              <button onClick={() => onHandleEndring(g.endring_ids, 'godkjenn')} className="btn-primary text-xs px-3 py-1.5">Godkjenn endring</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
