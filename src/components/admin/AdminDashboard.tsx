'use client'

import { useState } from 'react'

const UKEDAG_ORDER = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag']
const UKEDAG_SHORT: Record<string, string> = { mandag: 'Man', tirsdag: 'Tir', onsdag: 'Ons', torsdag: 'Tor', fredag: 'Fre' }
const IDRETT_COLORS: Record<string, string> = {
  kickboksing: 'bg-blue-50 text-blue-800',
  boksing: 'bg-amber-50 text-amber-800',
  kampsport: 'bg-purple-50 text-purple-800',
  judo: 'bg-green-50 text-green-800',
  bryting: 'bg-orange-50 text-orange-800',
  dans: 'bg-pink-50 text-pink-800',
  fekting: 'bg-teal-50 text-teal-800',
  bordtennis: 'bg-cyan-50 text-cyan-800',
}

function idrettColor(idrett?: string | null) {
  const key = (idrett ?? '').toLowerCase()
  return Object.entries(IDRETT_COLORS).find(([k]) => key.includes(k))?.[1] ?? 'bg-gray-100 text-gray-700'
}

function formatTime(t: string) { return t?.slice(0, 5) ?? '' }

export default function AdminDashboard({ haller, sesonger, aktivSesong, slots, soknader: initialSoknader, venteliste }: {
  haller: any[]; sesonger: any[]; aktivSesong: any; slots: any[]
  soknader: any[]; venteliste: any[]
}) {
  const [activeTab, setActiveTab] = useState<'haller' | 'soknader' | 'venteliste' | 'klubber'>('haller')
  const [selectedHalId, setSelectedHalId] = useState<string | null>(haller[0]?.id ?? null)
  const [soknader, setSoknader] = useState(initialSoknader)
  const [slotModal, setSlotModal] = useState<any | null>(null)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)

  const selectedHal = haller.find(h => h.id === selectedHalId)
  const halSlots = slots.filter(s => s.hal_id === selectedHalId)

  // Stats for selected hall
  const totalSlots = halSlots.length
  const ledige = halSlots.filter(s => !s.klubb_id).length
  const klubber = new Set(halSlots.filter(s => s.klubb_id).map(s => s.klubb_id)).size

  // Group soknader by slot
  const sokMap = new Map<string, any[]>()
  soknader.forEach(s => {
    if (!sokMap.has(s.slot_id)) sokMap.set(s.slot_id, [])
    sokMap.get(s.slot_id)!.push(s)
  })

  async function handleSoknad(id: string, status: 'godkjent' | 'avslatt') {
    const res = await fetch('/api/soknader', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) {
      setSoknader(prev => prev.map(s => {
        if (s.id === id) return { ...s, status }
        // auto-deny others for same slot
        const approved = prev.find(x => x.id === id)
        if (status === 'godkjent' && approved && s.slot_id === approved.slot_id && s.id !== id) return { ...s, status: 'avslatt' }
        return s
      }).filter(s => s.status === 'venter'))
    }
  }

  async function sendLinks() {
    if (!aktivSesong) return
    setSending(true)
    const res = await fetch('/api/admin/send-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sesong_id: aktivSesong.id }),
    })
    const data = await res.json()
    setSendResult(`Sendt til ${data.sent} klubber`)
    setSending(false)
  }

  const ubesvarteSok = soknader.filter(s => s.status === 'venter').length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="sticky top-0 z-20 flex h-13 items-center justify-between border-b border-gray-200 bg-white px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gray-900">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-white"><path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" /></svg>
          </div>
          <span className="text-sm font-semibold text-gray-900">Oslo kampidrett</span>
          <span className="h-4 w-px bg-gray-200" />
          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          {aktivSesong && (
            <button onClick={sendLinks} disabled={sending} className="btn text-xs">
              {sending ? 'Sender...' : '✉ Send lenker til klubber'}
            </button>
          )}
          {sendResult && <span className="text-xs text-green-600">{sendResult}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-5">
        {[
          { id: 'haller', label: 'Halloversikt' },
          { id: 'soknader', label: `Søknader${ubesvarteSok ? ` (${ubesvarteSok})` : ''}` },
          { id: 'venteliste', label: 'Venteliste' },
          { id: 'klubber', label: 'Klubber' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── HALLOVERSIKT ── */}
      {activeTab === 'haller' && (
        <div className="flex h-[calc(100vh-104px)]">
          {/* Sidebar */}
          <div className="w-52 shrink-0 overflow-y-auto border-r border-gray-200 bg-white py-3">
            <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Haller og saler</p>
            {haller.map(h => {
              const hSlotCount = slots.filter(s => s.hal_id === h.id).length
              const hSok = soknader.filter(s => s.hal_id === h.id).length
              return (
                <button key={h.id} onClick={() => setSelectedHalId(h.id)}
                  className={`flex w-full items-center justify-between border-l-2 px-4 py-2 text-left transition-colors hover:bg-gray-50 ${selectedHalId === h.id ? 'border-gray-900 bg-gray-50' : 'border-transparent'}`}>
                  <div>
                    <p className="text-xs font-medium text-gray-900 leading-snug">{h.navn}</p>
                    <p className="text-[10px] text-gray-400">{hSlotCount} slots</p>
                  </div>
                  {hSok > 0 && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{hSok}</span>}
                </button>
              )
            })}
          </div>

          {/* Main */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {selectedHal && (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">{selectedHal.navn}</h1>
                    <div className="flex gap-2 mt-1">
                      {selectedHal.underlag && <span className="badge bg-gray-100 text-gray-600">{selectedHal.underlag}</span>}
                      {selectedHal.stengedager && <span className="badge bg-amber-50 text-amber-600">Stengt: {selectedHal.stengedager}</span>}
                    </div>
                  </div>
                  <button className="btn text-xs">+ Legg til slot</button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: `${(totalSlots * 0.5).toFixed(0)}t`, lbl: 'Tildelt/uke' },
                    { val: `${(ledige * 0.5).toFixed(0)}t`, lbl: 'Ledig/uke' },
                    { val: klubber, lbl: 'Klubber' },
                    { val: sokMap.size, lbl: 'Søknader' },
                  ].map(s => (
                    <div key={s.lbl} className="card px-3 py-2.5">
                      <p className="text-xl font-semibold tabular-nums text-gray-900">{s.val}</p>
                      <p className="text-[10px] text-gray-500">{s.lbl}</p>
                    </div>
                  ))}
                </div>

                {/* Calendar */}
                <div className="card overflow-hidden">
                  <div className="grid" style={{ gridTemplateColumns: '60px repeat(5, 1fr)' }}>
                    <div className="border-b border-r border-gray-100 bg-gray-50 p-2" />
                    {UKEDAG_ORDER.map(d => (
                      <div key={d} className="border-b border-r border-gray-100 bg-gray-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 last:border-r-0">{UKEDAG_SHORT[d]}</div>
                    ))}
                    {['15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30'].map(time => (
                      <>
                        <div key={time + '-t'} className="border-b border-r border-gray-100 bg-gray-50 px-2 py-0 flex items-center">
                          <span className="text-[10px] font-mono text-gray-400">{time}</span>
                        </div>
                        {UKEDAG_ORDER.map(dag => {
                          const slot = halSlots.find(s => s.ukedag === dag && formatTime(s.fra_kl) === time)
                          return (
                            <div key={dag}
                              onClick={() => slot && setSlotModal(slot)}
                              className={`h-9 border-b border-r border-gray-100 last:border-r-0 cursor-pointer transition-colors ${slot?.klubb_id ? idrettColor(slot.klubber?.idrett) + ' hover:opacity-80' : 'hover:bg-green-50'}`}>
                              {slot?.klubb_id && (
                                <div className="flex h-full items-center px-1.5 overflow-hidden">
                                  <span className="truncate text-[10px] font-medium">{slot.klubber?.navn?.split(' ')[0]}</span>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </>
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex gap-3 flex-wrap border-t border-gray-100 bg-gray-50 px-4 py-2">
                    {Object.entries(IDRETT_COLORS).slice(0, 6).map(([k, v]) => (
                      <span key={k} className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span className={`h-2.5 w-2.5 rounded-sm ${v}`} />
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </span>
                    ))}
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className="h-2.5 w-2.5 rounded-sm bg-gray-100" />Ledig
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SØKNADER ── */}
      {activeTab === 'soknader' && (
        <div className="mx-auto max-w-2xl px-4 py-5 space-y-4">
          {sokMap.size === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">Ingen ubehandlede søknader</p>
          ) : Array.from(sokMap.entries()).map(([slotId, apps]) => (
            <div key={slotId} className="card overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="font-semibold text-sm text-gray-900">{apps[0].hal_navn}</p>
                <div className="flex gap-2 mt-0.5">
                  <span className="badge bg-gray-100 text-gray-600">{apps[0].ukedag.charAt(0).toUpperCase() + apps[0].ukedag.slice(1)} {formatTime(apps[0].fra_kl)}–{formatTime(apps[0].til_kl)}</span>
                  {apps[0].underlag && <span className="badge bg-gray-100 text-gray-600">{apps[0].underlag}</span>}
                  <span className="badge bg-amber-50 text-amber-700">{apps.length} søker{apps.length > 1 ? 'e' : ''}</span>
                </div>
              </div>
              {apps.map((app: any) => (
                <div key={app.id} className="flex items-start gap-4 border-b border-gray-50 px-4 py-3 last:border-b-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${idrettColor(app.idrett)}`}>
                    {app.klubb_navn.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{app.klubb_navn}</p>
                      <span className={`badge text-[10px] ${app.gruppe === 'barn' ? 'bg-green-50 text-green-700' : app.gruppe === 'voksne' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                        {app.gruppe.charAt(0).toUpperCase() + app.gruppe.slice(1)}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Medlemmer</p>
                        <p className="text-sm font-semibold tabular-nums text-gray-900">{app.medlemstall ?? '–'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-gray-400">Timer/uke nå</p>
                        <p className="text-sm font-semibold tabular-nums text-gray-900">{app.eksisterende_timer ?? 0}t</p>
                      </div>
                    </div>
                    {app.begrunnelse && (
                      <p className="mt-1.5 text-xs italic text-gray-500 bg-gray-50 rounded px-2 py-1">«{app.begrunnelse}»</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button onClick={() => handleSoknad(app.id, 'godkjent')} className="btn-primary text-xs px-3 py-1.5">Godkjenn</button>
                    <button onClick={() => handleSoknad(app.id, 'avslatt')} className="btn btn-danger text-xs px-3 py-1.5">Avslå</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── VENTELISTE ── */}
      {activeTab === 'venteliste' && (
        <div className="mx-auto max-w-2xl px-4 py-5 space-y-3">
          {venteliste.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-12">Ingen klubber på venteliste</p>
          ) : venteliste.map((v: any) => (
            <div key={v.id} className="card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm text-gray-900">{v.klubber?.navn}</p>
                <div className="flex gap-2 mt-1">
                  {v.haller && <span className="badge bg-gray-100 text-gray-600">{v.haller.navn}</span>}
                  {v.gruppe && <span className="badge bg-blue-50 text-blue-700">{v.gruppe.charAt(0).toUpperCase() + v.gruppe.slice(1)}</span>}
                  <span className="text-xs text-gray-400">{new Date(v.meldt_dato).toLocaleDateString('nb-NO')}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => fetch('/api/venteliste', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, status: 'tildelt' }) })} className="btn-primary text-xs">Tildel plass</button>
                <button onClick={() => fetch('/api/venteliste', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id, status: 'inaktiv' }) })} className="btn text-xs">Fjern</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── SLOT MODAL ── */}
      {slotModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Rediger slot</p>
              <button onClick={() => setSlotModal(null)} className="text-gray-400 text-xl leading-none">×</button>
            </div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              {slotModal.haller?.navn} — {slotModal.ukedag.charAt(0).toUpperCase() + slotModal.ukedag.slice(1)} {formatTime(slotModal.fra_kl)}–{formatTime(slotModal.til_kl)}
            </p>
            <div>
              <label className="label mb-1.5">Tildelt klubb</label>
              <select className="input">
                <option value="">— Ledig —</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSlotModal(null)} className="btn">Avbryt</button>
              <button onClick={() => setSlotModal(null)} className="btn-primary">Lagre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
