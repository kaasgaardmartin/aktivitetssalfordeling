'use client'

import { useState, useRef } from 'react'
import type { Hall, Klubb, Sesong, Slot, Soknad, Endring, VentelisteItem } from './types'
import { UKEDAG_ORDER, UKEDAG_SHORT, UNDERLAG_OPTIONS, TIME_ROWS, idrettColor, formatTime, generate30minSlots } from './types'
import SoknaderTab from './SoknaderTab'
import EndringerTab from './EndringerTab'
import VentelisteTab from './VentelisteTab'
import KlubberTab from './KlubberTab'

interface DashboardProps {
  haller: Hall[]
  sesonger: Sesong[]
  aktivSesong: Sesong | null
  slots: Slot[]
  soknader: Soknad[]
  venteliste: VentelisteItem[]
  klubber: Klubb[]
  endringer: Endring[]
}

export default function AdminDashboard({ haller, sesonger, aktivSesong, slots: initialSlots, soknader: initialSoknader, venteliste, klubber, endringer: initialEndringer }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'haller' | 'soknader' | 'endringer' | 'venteliste' | 'klubber'>('haller')
  const [selectedHalId, setSelectedHalId] = useState<string | null>(haller[0]?.id ?? null)
  const [soknader, setSoknader] = useState(initialSoknader)
  const [slots, setSlots] = useState(initialSlots)
  const [slotModal, setSlotModal] = useState<Slot | null>(null)
  const [slotModalKlubbId, setSlotModalKlubbId] = useState('')
  const [slotModalSaving, setSlotModalSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [showNySesong, setShowNySesong] = useState(false)
  const [nySesongForm, setNySesongForm] = useState({ navn: '', frist: '', kopier_fra_sesong_id: '' })
  const [nySesongLaster, setNySesongLaster] = useState(false)
  const [nySesongFeil, setNySesongFeil] = useState('')
  const [showNyHall, setShowNyHall] = useState(false)
  const [nyHallForm, setNyHallForm] = useState({ navn: '', underlag: '', merknader: '', stengedager: '', adresse: '' })
  const [nyHallLaster, setNyHallLaster] = useState(false)
  const [nyHallFeil, setNyHallFeil] = useState('')
  const [showNySlot, setShowNySlot] = useState(false)
  const [nySlotForm, setNySlotForm] = useState({ ukedag: 'mandag', fra_kl: '16:00', til_kl: '22:30', klubb_id: '' })
  const [nySlotLaster, setNySlotLaster] = useState(false)
  const [nySlotFeil, setNySlotFeil] = useState('')
  const [endringer, setEndringer] = useState(initialEndringer)
  const [hallerState, setHallerState] = useState(haller)
  const [showEditHall, setShowEditHall] = useState(false)
  const [editHallForm, setEditHallForm] = useState({ id: '', navn: '', underlag: '', merknader: '', adresse: '', stengedager: '' })
  const [editHallLaster, setEditHallLaster] = useState(false)
  const [editHallFeil, setEditHallFeil] = useState('')
  const [editHallBilder, setEditHallBilder] = useState<string[]>([])
  const [uploadingBilde, setUploadingBilde] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const bildeInputRef = useRef<HTMLInputElement>(null)

  const selectedHal = hallerState.find(h => h.id === selectedHalId)
  const halSlots = slots.filter(s => s.hal_id === selectedHalId)
  const totalSlots = halSlots.length
  const ledige = halSlots.filter(s => !s.klubb_id).length
  const antallKlubber = new Set(halSlots.filter(s => s.klubb_id).map(s => s.klubb_id)).size
  const sokMap = new Map<string, Soknad[]>()
  soknader.forEach(s => {
    if (!sokMap.has(s.slot_id)) sokMap.set(s.slot_id, [])
    sokMap.get(s.slot_id)!.push(s)
  })

  // ── Handlers ──

  async function handleSoknad(id: string, status: 'godkjent' | 'avslatt') {
    const res = await fetch('/api/soknader', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) {
      setSoknader(prev => prev.map(s => {
        if (s.id === id) return { ...s, status }
        const approved = prev.find(x => x.id === id)
        if (status === 'godkjent' && approved && s.slot_id === approved.slot_id && s.id !== id) return { ...s, status: 'avslatt' }
        return s
      }).filter(s => s.status === 'venter'))
    }
  }

  async function handleEndring(id: string, action: 'godkjenn' | 'avslaa') {
    const res = await fetch('/api/svar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    if (res.ok) {
      setEndringer(prev => prev.filter(e => e.id !== id))
      if (action === 'godkjenn') window.location.reload()
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

  async function opprettSesong(e: React.FormEvent) {
    e.preventDefault()
    setNySesongLaster(true)
    setNySesongFeil('')
    const res = await fetch('/api/sesonger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        navn: nySesongForm.navn,
        frist: nySesongForm.frist,
        kopier_fra_sesong_id: nySesongForm.kopier_fra_sesong_id || undefined,
      }),
    })
    if (res.ok) {
      setShowNySesong(false)
      setNySesongForm({ navn: '', frist: '', kopier_fra_sesong_id: '' })
      window.location.reload()
    } else {
      const data = await res.json()
      setNySesongFeil(data.error || 'Noe gikk galt')
    }
    setNySesongLaster(false)
  }

  async function opprettHall(e: React.FormEvent) {
    e.preventDefault()
    setNyHallLaster(true)
    setNyHallFeil('')
    const res = await fetch('/api/haller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        navn: nyHallForm.navn,
        underlag: nyHallForm.underlag || null,
        merknader: nyHallForm.merknader || null,
        adresse: nyHallForm.adresse || null,
        stengedager: nyHallForm.stengedager || null,
      }),
    })
    if (res.ok) {
      setShowNyHall(false)
      setNyHallForm({ navn: '', underlag: '', merknader: '', stengedager: '', adresse: '' })
      window.location.reload()
    } else {
      const data = await res.json()
      setNyHallFeil(data.error || 'Noe gikk galt')
    }
    setNyHallLaster(false)
  }

  function openSlotModal(slot: Slot) {
    setSlotModal(slot)
    setSlotModalKlubbId(slot.klubb_id ?? '')
  }

  async function lagreSlot() {
    if (!slotModal) return
    setSlotModalSaving(true)
    const res = await fetch('/api/tidslots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: slotModal.id, klubb_id: slotModalKlubbId || null }),
    })
    if (res.ok) {
      const tildeltKlubb = klubber.find(k => k.id === (slotModalKlubbId || null)) ?? null
      setSlots(prev => prev.map(s => s.id === slotModal.id ? { ...s, klubb_id: slotModalKlubbId || null, klubber: tildeltKlubb ? { id: tildeltKlubb.id, navn: tildeltKlubb.navn, idrett: tildeltKlubb.idrett } : null } : s))
      setSlotModal(null)
    }
    setSlotModalSaving(false)
  }

  async function slettSlot() {
    if (!slotModal || !confirm('Er du sikker på at du vil slette denne tidssloten?')) return
    const res = await fetch(`/api/tidslots?id=${slotModal.id}`, { method: 'DELETE' })
    if (res.ok) {
      setSlots(prev => prev.filter(s => s.id !== slotModal.id))
      setSlotModal(null)
    }
  }

  async function opprettSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedHalId || !aktivSesong) return
    setNySlotLaster(true)
    setNySlotFeil('')
    const intervals = generate30minSlots(nySlotForm.fra_kl, nySlotForm.til_kl)
    if (intervals.length === 0) {
      setNySlotFeil('Tidsrommet må være minst 30 minutter')
      setNySlotLaster(false)
      return
    }
    const payload = intervals.map(s => ({
      hal_id: selectedHalId,
      sesong_id: aktivSesong.id,
      ukedag: nySlotForm.ukedag,
      fra_kl: s.fra_kl,
      til_kl: s.til_kl,
      klubb_id: nySlotForm.klubb_id || null,
    }))
    const res = await fetch('/api/tidslots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const created = await res.json()
      const tildeltKlubb = klubber.find(k => k.id === nySlotForm.klubb_id) ?? null
      const newSlots = created.map((c: Slot) => ({
        ...c,
        haller: { id: selectedHalId, navn: selectedHal?.navn, underlag: selectedHal?.underlag },
        klubber: tildeltKlubb ? { id: tildeltKlubb.id, navn: tildeltKlubb.navn, idrett: tildeltKlubb.idrett } : null,
      }))
      setSlots(prev => [...prev, ...newSlots])
      setShowNySlot(false)
      setNySlotForm({ ukedag: 'mandag', fra_kl: '16:00', til_kl: '22:30', klubb_id: '' })
    } else {
      const data = await res.json()
      setNySlotFeil(data.error || 'Noe gikk galt')
    }
    setNySlotLaster(false)
  }

  function openEditHall(hal: Hall) {
    setEditHallForm({
      id: hal.id,
      navn: hal.navn ?? '',
      underlag: hal.underlag ?? '',
      merknader: hal.merknader ?? '',
      adresse: hal.adresse ?? '',
      stengedager: hal.stengedager ?? '',
    })
    setEditHallBilder(hal.bilder ?? [])
    setEditHallFeil('')
    setShowEditHall(true)
  }

  async function lagreEditHall(e: React.FormEvent) {
    e.preventDefault()
    setEditHallLaster(true)
    setEditHallFeil('')
    const res = await fetch('/api/haller', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editHallForm.id,
        navn: editHallForm.navn,
        underlag: editHallForm.underlag || null,
        merknader: editHallForm.merknader || null,
        adresse: editHallForm.adresse || null,
        stengedager: editHallForm.stengedager || null,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      setHallerState(prev => prev.map(h => h.id === updated.id ? { ...h, ...updated } : h))
      setShowEditHall(false)
    } else {
      const data = await res.json()
      setEditHallFeil(data.error || 'Noe gikk galt')
    }
    setEditHallLaster(false)
  }

  async function slettHall() {
    if (!editHallForm.id) return
    const hal = hallerState.find(h => h.id === editHallForm.id)
    const halSlotCount = slots.filter(s => s.hal_id === editHallForm.id).length
    const msg = halSlotCount > 0
      ? `Er du sikker på at du vil slette "${hal?.navn}"? ${halSlotCount} tidslot${halSlotCount !== 1 ? 'er' : ''} vil også bli slettet.`
      : `Er du sikker på at du vil slette "${hal?.navn}"?`
    if (!confirm(msg)) return
    const res = await fetch(`/api/haller?id=${editHallForm.id}`, { method: 'DELETE' })
    if (res.ok) {
      setHallerState(prev => prev.filter(h => h.id !== editHallForm.id))
      setSlots(prev => prev.filter(s => s.hal_id !== editHallForm.id))
      setSelectedHalId(hallerState.find(h => h.id !== editHallForm.id)?.id ?? null)
      setShowEditHall(false)
    }
  }

  async function uploadBilde(file: File) {
    if (!editHallForm.id) return
    setUploadingBilde(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('hal_id', editHallForm.id)
    const res = await fetch('/api/haller/bilder', { method: 'POST', body: formData })
    if (res.ok) {
      const { hall } = await res.json()
      setEditHallBilder(hall.bilder ?? [])
      setHallerState(prev => prev.map(h => h.id === hall.id ? { ...h, bilder: hall.bilder } : h))
    }
    setUploadingBilde(false)
  }

  async function slettBilde(url: string) {
    if (!editHallForm.id || !confirm('Slette dette bildet?')) return
    const res = await fetch('/api/haller/bilder', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hal_id: editHallForm.id, url }),
    })
    if (res.ok) {
      const { hall } = await res.json()
      setEditHallBilder(hall.bilder ?? [])
      setHallerState(prev => prev.map(h => h.id === hall.id ? { ...h, bilder: hall.bilder } : h))
    }
  }

  const ubesvarteSok = soknader.filter(s => s.status === 'venter').length
  const ubehandledeEndringer = endringer.length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="sticky top-0 z-20 flex h-13 items-center justify-between border-b border-gray-200 bg-white px-3 md:px-5">
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gray-900">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-white"><path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" /></svg>
          </div>
          <span className="text-sm font-semibold text-gray-900 hidden sm:inline">Aktivitetssaler Oslo</span>
          <span className="h-4 w-px bg-gray-200 hidden sm:inline" />
          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Admin</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={() => setShowNySesong(true)} className="btn text-xs hidden sm:inline-flex">+ Ny sesong</button>
          <button onClick={() => setShowNyHall(true)} className="btn text-xs hidden sm:inline-flex">+ Ny hall</button>
          {aktivSesong && (
            <button onClick={sendLinks} disabled={sending} className="btn text-xs">
              {sending ? 'Sender...' : 'Send lenker'}
            </button>
          )}
          {sendResult && <span className="text-xs text-green-600">{sendResult}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-3 md:px-5 overflow-x-auto">
        {([
          { id: 'haller', label: 'Halloversikt' },
          { id: 'soknader', label: `Søknader${ubesvarteSok ? ` (${ubesvarteSok})` : ''}` },
          { id: 'endringer', label: `Endringer${ubehandledeEndringer ? ` (${ubehandledeEndringer})` : ''}` },
          { id: 'venteliste', label: 'Venteliste' },
          { id: 'klubber', label: 'Klubber' },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap border-b-2 px-3 md:px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── HALLOVERSIKT ── */}
      {activeTab === 'haller' && (
        <div className="flex h-[calc(100vh-104px)]">
          {/* Sidebar — responsive */}
          <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-52 shrink-0 overflow-y-auto border-r border-gray-200 bg-white py-3 absolute md:relative z-10 h-full`}>
            <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Haller og saler</p>
            {hallerState.map(h => {
              const hSlotCount = slots.filter(s => s.hal_id === h.id).length
              const hSok = soknader.filter(s => s.hal_id === h.id).length
              return (
                <button key={h.id} onClick={() => { setSelectedHalId(h.id); setSidebarOpen(false) }}
                  className={`flex w-full items-center justify-between border-l-2 px-4 py-2 text-left transition-colors hover:bg-gray-50 ${selectedHalId === h.id ? 'border-gray-900 bg-gray-50' : 'border-transparent'}`}>
                  <div>
                    <p className="text-xs font-medium text-gray-900 leading-snug">{h.navn}</p>
                    <p className="text-[10px] text-gray-600">{hSlotCount} slots</p>
                  </div>
                  {hSok > 0 && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{hSok}</span>}
                </button>
              )
            })}
            {/* Mobile-only buttons */}
            <div className="md:hidden px-4 pt-3 space-y-2">
              <button onClick={() => setShowNySesong(true)} className="btn text-xs w-full">+ Ny sesong</button>
              <button onClick={() => setShowNyHall(true)} className="btn text-xs w-full">+ Ny hall</button>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-4">
            {selectedHal && (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-semibold text-gray-900">{selectedHal.navn}</h1>
                      <button onClick={() => openEditHall(selectedHal)} className="text-gray-500 hover:text-gray-700 transition-colors" title="Rediger hall">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                      </button>
                    </div>
                    {selectedHal.adresse && <p className="text-xs text-gray-600 mt-0.5">{selectedHal.adresse}</p>}
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {selectedHal.underlag && <span className="badge bg-gray-100 text-gray-600">{selectedHal.underlag}</span>}
                      {selectedHal.stengedager && <span className="badge bg-amber-50 text-amber-600">Stengt: {selectedHal.stengedager}</span>}
                    </div>
                    {selectedHal.bilder && selectedHal.bilder.length > 0 && (
                      <div className="flex gap-2 mt-2 overflow-x-auto">
                        {selectedHal.bilder.slice(0, 4).map((url, i) => (
                          <img key={i} src={url} alt={`${selectedHal.navn} bilde ${i + 1}`} className="h-16 w-24 rounded-lg object-cover border border-gray-200" />
                        ))}
                        {selectedHal.bilder.length > 4 && <span className="flex items-center text-xs text-gray-600">+{selectedHal.bilder.length - 4} til</span>}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowNySlot(true)} className="btn text-xs shrink-0">+ Legg til slot</button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { val: `${(totalSlots * 0.5).toFixed(0)}t`, lbl: 'Tildelt/uke' },
                    { val: `${(ledige * 0.5).toFixed(0)}t`, lbl: 'Ledig/uke' },
                    { val: antallKlubber, lbl: 'Klubber' },
                    { val: sokMap.size, lbl: 'Søknader' },
                  ].map(s => (
                    <div key={s.lbl} className="card px-3 py-2.5">
                      <p className="text-xl font-semibold tabular-nums text-gray-900">{s.val}</p>
                      <p className="text-[10px] text-gray-600">{s.lbl}</p>
                    </div>
                  ))}
                </div>

                {/* Calendar — responsive with horizontal scroll on mobile */}
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[500px]" style={{ gridTemplateColumns: '60px repeat(5, 1fr)' }}>
                      <div className="border-b border-r border-gray-200 bg-gray-50 p-2" />
                      {UKEDAG_ORDER.map(d => (
                        <div key={d} className="border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 last:border-r-0">{UKEDAG_SHORT[d]}</div>
                      ))}
                      {TIME_ROWS.map(time => (
                        <div key={time} className="contents">
                          <div className="border-b border-r border-gray-200 bg-gray-50 px-2 py-0 flex items-center">
                            <span className="text-[10px] font-mono text-gray-600">{time}</span>
                          </div>
                          {UKEDAG_ORDER.map(dag => {
                            const slot = halSlots.find(s => s.ukedag === dag && formatTime(s.fra_kl) === time)
                            return (
                              <div key={dag}
                                onClick={() => slot && openSlotModal(slot)}
                                className={`h-9 border-b border-r border-gray-200 last:border-r-0 cursor-pointer transition-colors ${slot?.klubb_id ? idrettColor(slot.klubber?.idrett) + ' hover:opacity-80' : 'hover:bg-green-50'}`}>
                                {slot?.klubb_id && (
                                  <div className="flex h-full items-center px-1.5 overflow-hidden">
                                    <span className="truncate text-[10px] font-medium">{slot.klubber?.navn?.split(' ')[0]}</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="flex gap-3 flex-wrap border-t border-gray-200 bg-gray-50 px-4 py-2">
                    {Object.entries(idrettColor).length && Object.keys({
                      kickboksing: 1, boksing: 1, kampsport: 1, judo: 1, bryting: 1, dans: 1
                    }).map(k => (
                      <span key={k} className="flex items-center gap-1 text-[10px] text-gray-600">
                        <span className={`h-2.5 w-2.5 rounded-sm ${idrettColor(k)}`} />
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </span>
                    ))}
                    <span className="flex items-center gap-1 text-[10px] text-gray-600">
                      <span className="h-2.5 w-2.5 rounded-sm bg-gray-100" />Ledig
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TAB COMPONENTS ── */}
      {activeTab === 'soknader' && <SoknaderTab soknader={soknader.filter(s => s.status === 'venter')} onHandleSoknad={handleSoknad} />}
      {activeTab === 'endringer' && <EndringerTab endringer={endringer} onHandleEndring={handleEndring} />}
      {activeTab === 'venteliste' && <VentelisteTab venteliste={venteliste} />}
      {activeTab === 'klubber' && <KlubberTab klubber={klubber} slots={slots} aktivSesong={aktivSesong} />}

      {/* ── SLOT MODAL (Rediger) ── */}
      {slotModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={() => setSlotModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Rediger slot</p>
              <button onClick={() => setSlotModal(null)} className="text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              {slotModal.haller?.navn} — {slotModal.ukedag.charAt(0).toUpperCase() + slotModal.ukedag.slice(1)} {formatTime(slotModal.fra_kl)}–{formatTime(slotModal.til_kl)}
            </p>
            <div>
              <label className="label mb-1.5">Tildelt klubb</label>
              <select className="input" value={slotModalKlubbId} onChange={e => setSlotModalKlubbId(e.target.value)}>
                <option value="">— Ledig —</option>
                {klubber.map(k => (
                  <option key={k.id} value={k.id}>{k.navn}{k.idrett ? ` (${k.idrett})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 justify-between">
              <button onClick={slettSlot} className="btn btn-danger text-xs px-3">Slett slot</button>
              <div className="flex gap-2">
                <button onClick={() => setSlotModal(null)} className="btn">Avbryt</button>
                <button onClick={lagreSlot} disabled={slotModalSaving} className="btn-primary">
                  {slotModalSaving ? 'Lagrer...' : 'Lagre'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NY SLOT MODAL ── */}
      {showNySlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowNySlot(false)}>
          <form onSubmit={opprettSlot} className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Legg til tidslot</p>
              <button type="button" onClick={() => setShowNySlot(false)} className="text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{selectedHal?.navn}</p>
            <div>
              <label className="label mb-1.5">Ukedag</label>
              <select className="input" required value={nySlotForm.ukedag} onChange={e => setNySlotForm(f => ({ ...f, ukedag: e.target.value }))}>
                {UKEDAG_ORDER.map(d => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label mb-1.5">Fra kl.</label>
                <input type="time" className="input" required step="1800" value={nySlotForm.fra_kl} onChange={e => setNySlotForm(f => ({ ...f, fra_kl: e.target.value }))} />
              </div>
              <div>
                <label className="label mb-1.5">Til kl.</label>
                <input type="time" className="input" required step="1800" value={nySlotForm.til_kl} onChange={e => setNySlotForm(f => ({ ...f, til_kl: e.target.value }))} />
              </div>
            </div>
            {(() => {
              const n = generate30minSlots(nySlotForm.fra_kl, nySlotForm.til_kl).length
              return n > 0 ? (
                <p className="text-xs text-gray-600 bg-blue-50 rounded-lg px-3 py-2">
                  {n} blokk{n > 1 ? 'er' : ''} à 30 min ({(n * 0.5).toFixed(1).replace('.0', '')}t totalt)
                </p>
              ) : null
            })()}
            <div>
              <label className="label mb-1.5">Tildel klubb (valgfritt)</label>
              <select className="input" value={nySlotForm.klubb_id} onChange={e => setNySlotForm(f => ({ ...f, klubb_id: e.target.value }))}>
                <option value="">— Ledig —</option>
                {klubber.map(k => (
                  <option key={k.id} value={k.id}>{k.navn}{k.idrett ? ` (${k.idrett})` : ''}</option>
                ))}
              </select>
            </div>
            {nySlotFeil && <p className="text-sm text-red-600">{nySlotFeil}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowNySlot(false)} className="btn">Avbryt</button>
              <button type="submit" disabled={nySlotLaster} className="btn-primary">
                {nySlotLaster ? 'Lagrer...' : `Legg til ${generate30minSlots(nySlotForm.fra_kl, nySlotForm.til_kl).length} blokk${generate30minSlots(nySlotForm.fra_kl, nySlotForm.til_kl).length !== 1 ? 'er' : ''}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── NY SESONG MODAL ── */}
      {showNySesong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowNySesong(false)}>
          <form onSubmit={opprettSesong} className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Opprett ny sesong</p>
              <button type="button" onClick={() => setShowNySesong(false)} className="text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div>
              <label className="label mb-1.5">Sesongnavn</label>
              <input className="input" required placeholder="F.eks. Treningstidsfordeling 2026/2027"
                value={nySesongForm.navn} onChange={e => setNySesongForm(f => ({ ...f, navn: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5">Svarfrist</label>
              <input type="date" className="input" required
                value={nySesongForm.frist} onChange={e => setNySesongForm(f => ({ ...f, frist: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5">Kopier fordeling fra</label>
              <select className="input"
                value={nySesongForm.kopier_fra_sesong_id} onChange={e => setNySesongForm(f => ({ ...f, kopier_fra_sesong_id: e.target.value }))}>
                <option value="">— Ikke kopier (tom sesong) —</option>
                {sesonger.map(s => (
                  <option key={s.id} value={s.id}>{s.navn}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-gray-600">Alle tidslots med klubbtildelinger kopieres som utgangspunkt</p>
            </div>
            {nySesongFeil && <p className="text-sm text-red-600">{nySesongFeil}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowNySesong(false)} className="btn">Avbryt</button>
              <button type="submit" disabled={nySesongLaster} className="btn-primary">
                {nySesongLaster ? 'Oppretter...' : 'Opprett sesong'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── NY HALL MODAL ── */}
      {showNyHall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowNyHall(false)}>
          <form onSubmit={opprettHall} className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Legg til hall / aktivitetssal</p>
              <button type="button" onClick={() => setShowNyHall(false)} className="text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div>
              <label className="label mb-1.5">Navn</label>
              <input className="input" required placeholder="F.eks. Dælenenga brytesal"
                value={nyHallForm.navn} onChange={e => setNyHallForm(f => ({ ...f, navn: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5">Adresse</label>
              <input className="input" placeholder="F.eks. Dælenggt. 18, 0567 Oslo"
                value={nyHallForm.adresse} onChange={e => setNyHallForm(f => ({ ...f, adresse: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5">Underlag</label>
              <select className="input"
                value={nyHallForm.underlag} onChange={e => setNyHallForm(f => ({ ...f, underlag: e.target.value }))}>
                <option value="">— Velg underlag —</option>
                {UNDERLAG_OPTIONS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1.5">Merknader</label>
              <input className="input" placeholder="Valgfritt"
                value={nyHallForm.merknader} onChange={e => setNyHallForm(f => ({ ...f, merknader: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5">Stengedager</label>
              <input className="input" placeholder="F.eks. helligdager, jul"
                value={nyHallForm.stengedager} onChange={e => setNyHallForm(f => ({ ...f, stengedager: e.target.value }))} />
            </div>
            {nyHallFeil && <p className="text-sm text-red-600">{nyHallFeil}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowNyHall(false)} className="btn">Avbryt</button>
              <button type="submit" disabled={nyHallLaster} className="btn-primary">
                {nyHallLaster ? 'Lagrer...' : 'Legg til hall'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── REDIGER HALL MODAL ── */}
      {showEditHall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowEditHall(false)}>
          <form onSubmit={lagreEditHall} className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Rediger hall</p>
              <button type="button" onClick={() => setShowEditHall(false)} className="text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div>
              <label className="label mb-1.5">Navn</label>
              <input className="input" required value={editHallForm.navn} onChange={e => setEditHallForm(f => ({ ...f, navn: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5">Adresse</label>
              <input className="input" placeholder="F.eks. Dælenggt. 18, 0567 Oslo" value={editHallForm.adresse} onChange={e => setEditHallForm(f => ({ ...f, adresse: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5">Underlag</label>
              <select className="input" value={editHallForm.underlag} onChange={e => setEditHallForm(f => ({ ...f, underlag: e.target.value }))}>
                <option value="">— Velg underlag —</option>
                {UNDERLAG_OPTIONS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1.5">Merknader</label>
              <input className="input" placeholder="Valgfritt" value={editHallForm.merknader} onChange={e => setEditHallForm(f => ({ ...f, merknader: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5">Stengedager</label>
              <input className="input" placeholder="F.eks. helligdager, jul" value={editHallForm.stengedager} onChange={e => setEditHallForm(f => ({ ...f, stengedager: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5">Bilder</label>
              {editHallBilder.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {editHallBilder.map((url, i) => (
                    <div key={i} className="group relative">
                      <img src={url} alt={`Bilde ${i + 1}`} className="h-24 w-full rounded-lg object-cover border border-gray-200" />
                      <button type="button" onClick={() => slettBilde(url)}
                        className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Slett bilde">&times;</button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={bildeInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                onChange={e => { if (e.target.files?.[0]) uploadBilde(e.target.files[0]); e.target.value = '' }} />
              <button type="button" onClick={() => bildeInputRef.current?.click()} disabled={uploadingBilde}
                className="btn text-xs w-full">
                {uploadingBilde ? 'Laster opp...' : '+ Last opp bilde'}
              </button>
            </div>
            {editHallFeil && <p className="text-sm text-red-600">{editHallFeil}</p>}
            <div className="flex gap-2 justify-between">
              <button type="button" onClick={slettHall} className="btn btn-danger text-xs px-3">Slett hall</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowEditHall(false)} className="btn">Avbryt</button>
                <button type="submit" disabled={editHallLaster} className="btn-primary">
                  {editHallLaster ? 'Lagrer...' : 'Lagre endringer'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
