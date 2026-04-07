'use client'

import type { Endring } from './types'
import { idrettColor, formatTime } from './types'

interface Props {
  endringer: Endring[]
  onHandleEndring: (id: string, action: 'godkjenn' | 'avslaa') => void
}

export default function EndringerTab({ endringer, onHandleEndring }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-5 space-y-4">
      {endringer.length === 0 ? (
        <p className="text-center text-sm text-gray-600 py-12">Ingen endringsforespørsler å behandle</p>
      ) : endringer.map((e) => (
        <div key={e.id} className="card overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${idrettColor(e.klubber?.idrett)}`}>
                {e.klubber?.navn?.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{e.klubber?.navn}</p>
                <p className="text-[10px] text-gray-600">Sendt {new Date(e.tidsstempel).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Nåværende tid</p>
                <p className="text-sm font-medium text-gray-900">{e.tidslots?.haller?.navn}</p>
                <p className="text-xs text-gray-600">
                  {e.tidslots?.ukedag?.charAt(0).toUpperCase()}{e.tidslots?.ukedag?.slice(1)} {formatTime(e.tidslots?.fra_kl ?? '')}–{formatTime(e.tidslots?.til_kl ?? '')}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-blue-400 mb-1">Ønsket endring</p>
                <p className="text-sm font-medium text-blue-900">
                  {e.ny_ukedag ? e.ny_ukedag.charAt(0).toUpperCase() + e.ny_ukedag.slice(1) : e.tidslots?.ukedag?.charAt(0).toUpperCase() + (e.tidslots?.ukedag?.slice(1) ?? '')}
                </p>
                <p className="text-xs text-blue-700">
                  {formatTime(e.ny_fra_kl || e.tidslots?.fra_kl || '')}–{formatTime(e.ny_til_kl || e.tidslots?.til_kl || '')}
                </p>
              </div>
            </div>
            {e.kommentar && (
              <p className="text-xs italic text-gray-600 bg-gray-50 rounded px-2 py-1">«{e.kommentar}»</p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => onHandleEndring(e.id, 'avslaa')} className="btn btn-danger text-xs px-3 py-1.5">Avslå</button>
              <button onClick={() => onHandleEndring(e.id, 'godkjenn')} className="btn-primary text-xs px-3 py-1.5">Godkjenn endring</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
