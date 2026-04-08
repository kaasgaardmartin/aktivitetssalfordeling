'use client'

import type { Soknad } from './types'
import { idrettColor, formatTime } from './types'

interface Props {
  soknader: Soknad[]
  onHandleSoknad: (id: string, status: 'godkjent' | 'avslatt') => void
}

export default function SoknaderTab({ soknader, onHandleSoknad }: Props) {
  const sokMap = new Map<string, Soknad[]>()
  soknader.forEach(s => {
    if (!sokMap.has(s.slot_id)) sokMap.set(s.slot_id, [])
    sokMap.get(s.slot_id)!.push(s)
  })

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 space-y-4">
      {sokMap.size === 0 ? (
        <p className="text-center text-sm text-gray-600 py-12">Ingen ubehandlede søknader</p>
      ) : Array.from(sokMap.entries()).map(([slotId, apps]) => (
        <div key={slotId} className="card overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3">
            <p className="font-semibold text-sm text-gray-900">{apps[0].hal_navn}</p>
            <div className="flex gap-2 mt-0.5">
              <span className="badge bg-gray-100 text-gray-600">{apps[0].ukedag.charAt(0).toUpperCase() + apps[0].ukedag.slice(1)} {formatTime(apps[0].fra_kl)}–{formatTime(apps[0].til_kl)}</span>
              {apps[0].underlag && <span className="badge bg-gray-100 text-gray-600">{apps[0].underlag}</span>}
              <span className="badge bg-amber-100 text-amber-900 ring-1 ring-amber-300">{apps.length} søker{apps.length > 1 ? 'e' : ''}</span>
            </div>
          </div>
          {apps.map((app) => (
            <div key={app.id} className="flex items-start gap-4 border-b border-gray-200 px-4 py-3 last:border-b-0">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${idrettColor(app.idrett)}`}>
                {app.klubb_navn.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{app.klubb_navn}</p>
                  <span className={`badge text-[10px] ${app.gruppe === 'barn' ? 'bg-green-100 text-green-900 ring-1 ring-green-300' : app.gruppe === 'voksne' ? 'bg-blue-100 text-blue-900 ring-1 ring-blue-300' : 'bg-purple-100 text-purple-900 ring-1 ring-purple-300'}`}>
                    {app.gruppe.charAt(0).toUpperCase() + app.gruppe.slice(1)}
                  </span>
                </div>
                <div className="flex gap-4 mt-1">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-600">Medlemmer</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900">{app.medlemstall ?? '–'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-600">Timer/uke nå</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900">{app.eksisterende_timer ?? 0}t</p>
                  </div>
                </div>
                {app.begrunnelse && (
                  <p className="mt-1.5 text-xs italic text-gray-600 bg-gray-50 rounded px-2 py-1">«{app.begrunnelse}»</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => onHandleSoknad(app.id, 'godkjent')} className="btn-primary text-xs px-3 py-1.5">Godkjenn</button>
                <button onClick={() => onHandleSoknad(app.id, 'avslatt')} className="btn btn-danger text-xs px-3 py-1.5">Avslå</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
