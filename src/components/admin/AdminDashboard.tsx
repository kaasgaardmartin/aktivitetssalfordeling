'use client'

import { useState, useRef } from 'react'
import type { Hall, Klubb, Sesong, Slot, Soknad, Endring, VentelisteItem } from './types'
import { UKEDAG_ORDER, UKEDAG_SHORT, UNDERLAG_OPTIONS, TIME_ROWS, idrettColor, formatTime, generate30minSlots } from './types'
import dynamic from 'next/dynamic'
import SoknaderTab from './SoknaderTab'
import EndringerTab from './EndringerTab'
import VentelisteTab from './VentelisteTab'
import KlubberTab from './KlubberTab'
import AuditTab from './AuditTab'
import KapasitetTab from './KapasitetTab'
import StatistikkTab from './StatistikkTab'
import RegistreringerTab from './RegistreringerTab'
import EmailTestModal from './EmailTestModal'
import { exportHallerExcel } from './exportExcel'

// Leaflet depends on window/document, so load client-side only
const HallerKart = dynamic(() => import('./HallerKart'), { ssr: false, loading: () => <p className="p-6 text-xs text-gray-600">Laster kart...</p> })

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
  const [activeTab, setActiveTab] = useState<'haller' | 'kapasitet' | 'statistikk' | 'soknader' | 'endringer' | 'venteliste' | 'klubber' | 'registreringer' | 'kart' | 'logg'>('haller')
  const [selectedHalId, setSelectedHalId] = useState<string | null>(haller[0]?.id ?? null)
  const [soknader, setSoknader] = useState(initialSoknader)
  const [slots, setSlots] = useState(initialSlots)
  const [slotModal, setSlotModal] = useState<Slot | null>(null)
  const [slotModalKlubbId, setSlotModalKlubbId] = useState('')
  const [slotModalIdrett, setSlotModalIdrett] = useState('')
  const [slotModalSaving, setSlotModalSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [showNySesong, setShowNySesong] = useState(false)
  const [nySesongForm, setNySesongForm] = useState({ navn: '', frist: '', kopier_fra_sesong_id: '' })
  const [nySesongLaster, setNySesongLaster] = useState(false)
  const [nySesongFeil, setNySesongFeil] = useState('')
  const [showNyHall, setShowNyHall] = useState(false)
  const [showEmailTest, setShowEmailTest] = useState(false)
  const [nyHallForm, setNyHallForm] = useState({ navn: '', underlag: '', merknader: '', stengedager: '', adresse: '' })
  const [nyHallLaster, setNyHallLaster] = useState(false)
  const [nyHallFeil, setNyHallFeil] = useState('')
  const [showNySlot, setShowNySlot] = useState(false)
  const [nySlotForm, setNySlotForm] = useState({ ukedag: 'mandag', fra_kl: '16:00', til_kl: '22:30', klubb_id: '', idrett: '', utilgjengelig: false })
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
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set())
  const [bulkKlubbId, setBulkKlubbId] = useState('')
  const [bulkIdrett, setBulkIdrett] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const bildeInputRef = useRef<HTMLInputElement>(null)

  function getIdretter(klubbId: string | null): string[] {
    if (!klubbId) return []
    const k = klubber.find(x => x.id === klubbId)
    if (!k?.idrett) return []
    return k.idrett.split(',').map(s => s.trim()).filter(Boolean)
  }

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
    } else {
      const detail = await res.json().catch(() => ({}))
      alert(`Kunne ikke ${status === 'godkjent' ? 'godkjenne' : 'avslå'} søknad: ${detail.error ?? res.statusText}`)
    }
  }

  async function handleEndring(ids: string[], action: 'godkjenn' | 'avslaa') {
    const res = await fetch('/api/svar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    })
    if (res.ok) {
      const idSet = new Set(ids)
      setEndringer(prev => prev.filter(e => !idSet.has(e.id)))
      if (action === 'godkjenn') window.location.reload()
    } else {
      const detail = await res.json().catch(() => ({}))
      alert(`Kunne ikke ${action === 'godkjenn' ? 'godkjenne' : 'avslå'}: ${detail.error ?? res.statusText}`)
    }
  }

  async function toggleLaast() {
    if (!aktivSesong) return
    const ny = !aktivSesong.laast
    const bekreftMsg = ny
      ? `Lås tildelingen for «${aktivSesong.navn}»?\n\nIngen vil kunne endre slots, søknader, svar eller bytter før du åpner igjen.`
      : `Åpne tildelingen for «${aktivSesong.navn}» igjen?`
    if (!confirm(bekreftMsg)) return
    const res = await fetch('/api/sesonger', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: aktivSesong.id, laast: ny }),
    })
    if (res.ok) {
      window.location.reload()
    } else {
      const detail = await res.json().catch(() => ({}))
      alert(`Kunne ikke ${ny ? 'låse' : 'åpne'}: ${detail.error ?? res.statusText}`)
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
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      setSendResult(`Feil: ${detail.error ?? res.statusText}`)
      setSending(false)
      return
    }
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
    setSlotModalIdrett(slot.idrett ?? '')
  }

  async function lagreSlot() {
    if (!slotModal) return
    setSlotModalSaving(true)
    // Hvis sloten er markert utilgjengelig, frigjør (sett ledig) før vi tildeler klubb
    if (slotModal.status === 'utilgjengelig') {
      await fetch('/api/tidslots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [slotModal.id], status: 'ledig' }),
      })
    }
    const idrettVal = slotModalIdrett || null
    const res = await fetch('/api/tidslots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: slotModal.id, klubb_id: slotModalKlubbId || null, idrett: idrettVal }),
    })
    if (res.ok) {
      const tildeltKlubb = klubber.find(k => k.id === (slotModalKlubbId || null)) ?? null
      setSlots(prev => prev.map(s => s.id === slotModal.id ? { ...s, klubb_id: slotModalKlubbId || null, idrett: idrettVal, status: 'ledig', klubber: tildeltKlubb ? { id: tildeltKlubb.id, navn: tildeltKlubb.navn, idrett: tildeltKlubb.idrett } : null } : s))
      setSlotModal(null)
    }
    setSlotModalSaving(false)
  }

  async function markerUtilgjengelig() {
    if (!slotModal) return
    setSlotModalSaving(true)
    const res = await fetch('/api/tidslots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [slotModal.id], status: 'utilgjengelig' }),
    })
    if (res.ok) {
      setSlots(prev => prev.map(s => s.id === slotModal.id ? { ...s, klubb_id: null, status: 'utilgjengelig', klubber: null } : s))
      setSlotModal(null)
    }
    setSlotModalSaving(false)
  }

  async function frigjorSlot() {
    if (!slotModal) return
    setSlotModalSaving(true)
    const res = await fetch('/api/tidslots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [slotModal.id], status: 'ledig' }),
    })
    if (res.ok) {
      setSlots(prev => prev.map(s => s.id === slotModal.id ? { ...s, status: 'ledig' } : s))
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

  function toggleSlotSelection(slotId: string) {
    setSelectedSlotIds(prev => {
      const next = new Set(prev)
      if (next.has(slotId)) next.delete(slotId)
      else next.add(slotId)
      return next
    })
  }

  function selectAllLedige() {
    const ledige = halSlots.filter(s => !s.klubb_id && s.status !== 'utilgjengelig')
    setSelectedSlotIds(new Set(ledige.map(s => s.id)))
  }

  async function selectDag(dag: string) {
    const dagSlots = halSlots.filter(s => s.ukedag === dag)
    // Hvis alle eksisterende er valgt, deselect
    if (dagSlots.length === TIME_ROWS.length && dagSlots.every(s => selectedSlotIds.has(s.id))) {
      setSelectedSlotIds(prev => {
        const next = new Set(prev)
        dagSlots.forEach(s => next.delete(s.id))
        return next
      })
      return
    }
    // Opprett manglende slots for hele dagen
    if (!selectedHalId || !aktivSesong) return
    const existingTimes = new Set(dagSlots.map(s => formatTime(s.fra_kl)))
    const missingTimes = TIME_ROWS.filter(t => !existingTimes.has(t))
    let newSlots: Slot[] = []
    if (missingTimes.length > 0) {
      const payload = missingTimes.map(time => {
        const mins = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]) + 30
        const til = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
        return { hal_id: selectedHalId, sesong_id: aktivSesong.id, ukedag: dag, fra_kl: time, til_kl: til }
      })
      const res = await fetch('/api/tidslots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const created = await res.json()
        newSlots = created.map((c: any) => ({
          ...c,
          haller: { id: selectedHalId, navn: selectedHal?.navn ?? '', underlag: selectedHal?.underlag ?? null },
          klubber: null,
        }))
        setSlots(prev => [...prev, ...newSlots])
      }
    }
    // Velg alle slots for denne dagen
    const allIds = [...dagSlots.map(s => s.id), ...newSlots.map(s => s.id)]
    setSelectedSlotIds(prev => {
      const next = new Set(prev)
      allIds.forEach(id => next.add(id))
      return next
    })
  }

  async function bulkTildelKlubb() {
    if (selectedSlotIds.size === 0 || !bulkKlubbId) return
    setBulkSaving(true)
    const ids = [...selectedSlotIds]
    const idrettVal = bulkIdrett || null
    // First set all to ledig status (in case any are utilgjengelig)
    await fetch('/api/tidslots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status: 'ledig' }),
    })
    // Bulk assign club + idrett
    const res = await fetch('/api/tidslots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, klubb_id: bulkKlubbId, idrett: idrettVal }),
    })
    if (res.ok) {
      const tildeltKlubb = klubber.find(k => k.id === bulkKlubbId) ?? null
      setSlots(prev => prev.map(s => selectedSlotIds.has(s.id) ? { ...s, klubb_id: bulkKlubbId, idrett: idrettVal, status: 'ledig', klubber: tildeltKlubb ? { id: tildeltKlubb.id, navn: tildeltKlubb.navn, idrett: tildeltKlubb.idrett } : null } : s))
      setSelectedSlotIds(new Set())
      setBulkKlubbId('')
      setBulkIdrett('')
    }
    setBulkSaving(false)
  }

  async function bulkFrigjor() {
    if (selectedSlotIds.size === 0) return
    setBulkSaving(true)
    const ids = [...selectedSlotIds]
    // Set status to ledig and remove club
    await fetch('/api/tidslots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status: 'ledig' }),
    })
    // Remove club assignment from each
    await Promise.all(ids.map(id =>
      fetch('/api/tidslots', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, klubb_id: null }),
      })
    ))
    setSlots(prev => prev.map(s => selectedSlotIds.has(s.id) ? { ...s, klubb_id: null, status: 'ledig', klubber: null } : s))
    setSelectedSlotIds(new Set())
    setBulkSaving(false)
  }

  async function bulkMarkerUtilgjengelig() {
    if (selectedSlotIds.size === 0) return
    setBulkSaving(true)
    const ids = [...selectedSlotIds]
    const res = await fetch('/api/tidslots', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status: 'utilgjengelig' }),
    })
    if (res.ok) {
      setSlots(prev => prev.map(s => selectedSlotIds.has(s.id) ? { ...s, klubb_id: null, status: 'utilgjengelig', klubber: null } : s))
      setSelectedSlotIds(new Set())
    }
    setBulkSaving(false)
  }

  async function bulkSlett() {
    if (selectedSlotIds.size === 0) return
    if (!confirm(`Er du sikker på at du vil slette ${selectedSlotIds.size} tidslot${selectedSlotIds.size !== 1 ? 'er' : ''}?`)) return
    setBulkSaving(true)
    const ids = [...selectedSlotIds]
    const results = await Promise.all(ids.map(id =>
      fetch(`/api/tidslots?id=${id}`, { method: 'DELETE' })
    ))
    if (results.every(r => r.ok)) {
      setSlots(prev => prev.filter(s => !selectedSlotIds.has(s.id)))
      setSelectedSlotIds(new Set())
    }
    setBulkSaving(false)
  }

  async function opprettSlotForCell(dag: string, time: string, addToSelection: boolean) {
    if (!selectedHalId || !aktivSesong) return
    const til = `${String(Math.floor((parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]) + 30) / 60)).padStart(2, '0')}:${String((parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]) + 30) % 60).padStart(2, '0')}`
    const res = await fetch('/api/tidslots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hal_id: selectedHalId, sesong_id: aktivSesong.id, ukedag: dag, fra_kl: time, til_kl: til }),
    })
    if (res.ok) {
      const created = (await res.json())[0]
      const newSlot: Slot = {
        ...created,
        haller: { id: selectedHalId, navn: selectedHal?.navn ?? '', underlag: selectedHal?.underlag ?? null },
        klubber: null,
      }
      setSlots(prev => [...prev, newSlot])
      if (addToSelection) {
        setSelectedSlotIds(prev => new Set([...prev, newSlot.id]))
      } else {
        openSlotModal(newSlot)
      }
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
    const klubbForPayload = nySlotForm.utilgjengelig ? null : (nySlotForm.klubb_id || null)
    const idrettForPayload = nySlotForm.utilgjengelig ? null : (nySlotForm.idrett || null)
    const payload = intervals.map(s => ({
      hal_id: selectedHalId,
      sesong_id: aktivSesong.id,
      ukedag: nySlotForm.ukedag,
      fra_kl: s.fra_kl,
      til_kl: s.til_kl,
      klubb_id: klubbForPayload,
      idrett: idrettForPayload,
    }))
    const res = await fetch('/api/tidslots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const created = await res.json()
      // Hvis utilgjengelig: følg opp med PATCH for å sette status på alle nye slots
      let finalCreated = created as Slot[]
      if (nySlotForm.utilgjengelig && created.length > 0) {
        await fetch('/api/tidslots', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: created.map((c: Slot) => c.id), status: 'utilgjengelig' }),
        })
        finalCreated = created.map((c: Slot) => ({ ...c, status: 'utilgjengelig' as const }))
      }
      const tildeltKlubb = klubber.find(k => k.id === klubbForPayload) ?? null
      const newSlots = finalCreated.map((c: Slot) => ({
        ...c,
        haller: { id: selectedHalId, navn: selectedHal?.navn ?? '', underlag: selectedHal?.underlag ?? null },
        klubber: tildeltKlubb ? { id: tildeltKlubb.id, navn: tildeltKlubb.navn, idrett: tildeltKlubb.idrett } : null,
      }))
      setSlots(prev => [...prev, ...newSlots])
      setShowNySlot(false)
      setNySlotForm({ ukedag: 'mandag', fra_kl: '16:00', til_kl: '22:30', klubb_id: '', idrett: '', utilgjengelig: false })
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

  async function hentBildeFraUrl(url: string) {
    if (!editHallForm.id) return
    if (!url || !url.startsWith('http')) { alert('Ugyldig URL'); return }
    setUploadingBilde(true)
    const res = await fetch('/api/haller/bilder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hal_id: editHallForm.id, url }),
    })
    if (res.ok) {
      const { hall } = await res.json()
      setEditHallBilder(hall.bilder ?? [])
      setHallerState(prev => prev.map(h => h.id === hall.id ? { ...h, bilder: hall.bilder } : h))
    } else {
      const detail = await res.json().catch(() => ({}))
      alert(`Kunne ikke hente bilde: ${detail.error ?? res.statusText}`)
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
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-900 ring-1 ring-blue-300">Admin</span>
          {aktivSesong?.laast && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900 ring-1 ring-red-300" title="Tildelingen er låst — ingen kan endre den">🔒 Låst</span>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={() => exportHallerExcel(hallerState, slots)} className="btn text-xs hidden sm:inline-flex">Eksport Excel</button>
          <button onClick={() => setShowNySesong(true)} className="btn text-xs hidden sm:inline-flex">+ Ny sesong</button>
          <button onClick={() => setShowNyHall(true)} className="btn text-xs hidden sm:inline-flex">+ Ny hall</button>
          {aktivSesong && (
            <button onClick={toggleLaast} className={`btn text-xs ${aktivSesong.laast ? 'bg-red-50 text-red-900 ring-red-300 hover:bg-red-100' : ''}`} title={aktivSesong.laast ? 'Åpne tildelingen for endringer' : 'Lås tildelingen mot endringer'}>
              {aktivSesong.laast ? '🔓 Åpne' : '🔒 Lås'}
            </button>
          )}
          {aktivSesong && (
            <button onClick={sendLinks} disabled={sending} className="btn text-xs">
              {sending ? 'Sender...' : 'Send lenker'}
            </button>
          )}

          <button onClick={() => setShowEmailTest(true)} className="btn text-xs hidden sm:inline-flex" title="Send testmail for å verifisere e-postoppsettet">
            ✉️ Testmail
          </button>
          {sendResult && <span className="text-xs text-green-600">{sendResult}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-3 md:px-5 overflow-x-auto">
        {([
          { id: 'haller', label: 'Halloversikt' },
          { id: 'kapasitet', label: 'Kapasitet' },
          { id: 'statistikk', label: 'Statistikk' },
          { id: 'soknader', label: `Søknader${ubesvarteSok ? ` (${ubesvarteSok})` : ''}` },
          { id: 'endringer', label: `Endringer${ubehandledeEndringer ? ` (${ubehandledeEndringer})` : ''}` },
          { id: 'venteliste', label: 'Venteliste' },
          { id: 'klubber', label: 'Klubber' },
          { id: 'registreringer', label: 'Nye søknader' },
          { id: 'kart', label: 'Kart' },
          { id: 'logg', label: 'Logg' },
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
                <button key={h.id} onClick={() => { setSelectedHalId(h.id); setSidebarOpen(false); setSelectedSlotIds(new Set()) }}
                  className={`flex w-full items-center justify-between border-l-2 px-4 py-2 text-left transition-colors hover:bg-gray-50 ${selectedHalId === h.id ? 'border-gray-900 bg-gray-50' : 'border-transparent'}`}>
                  <div>
                    <p className="text-xs font-medium text-gray-900 leading-snug">{h.navn}</p>
                    <p className="text-[10px] text-gray-600">{hSlotCount} slots</p>
                  </div>
                  {hSok > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-300">{hSok}</span>}
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
                      <span className="text-[10px] text-gray-500 italic ml-1">Hold Ctrl/Cmd og klikk for flervalg</span>
                    </div>
                    {selectedHal.adresse && <p className="text-xs text-gray-600 mt-0.5">{selectedHal.adresse}</p>}
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {selectedHal.underlag && <span className="badge bg-gray-100 text-gray-600">{selectedHal.underlag}</span>}
                      {selectedHal.stengedager && <span className="badge bg-amber-100 text-amber-900 ring-1 ring-amber-300">Stengt: {selectedHal.stengedager}</span>}
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
                      <div className="border-b border-r border-gray-300 bg-gray-100 p-2" />
                      {UKEDAG_ORDER.map(d => (
                        <div key={d} onClick={() => selectDag(d)}
                          className="border-b border-r border-gray-300 bg-gray-100 px-2 py-2 text-center text-xs font-bold uppercase tracking-wider text-gray-800 last:border-r-0 cursor-pointer hover:bg-gray-200 select-none"
                          title={`Klikk for å velge alle slots på ${UKEDAG_SHORT[d]}`}>{UKEDAG_SHORT[d]}</div>
                      ))}
                      {TIME_ROWS.map(time => (
                        <div key={time} className="contents">
                          <div className="border-b border-r border-gray-300 bg-gray-100 px-2 py-0 flex items-center">
                            <span className="text-[10px] font-mono font-semibold text-gray-800">{time}</span>
                          </div>
                          {UKEDAG_ORDER.map(dag => {
                            const slot = halSlots.find(s => s.ukedag === dag && formatTime(s.fra_kl) === time)
                            const isUtilgj = slot?.status === 'utilgjengelig'
                            const isSelected = slot ? selectedSlotIds.has(slot.id) : false
                            const klassen = isSelected
                              ? 'ring-2 ring-inset ring-blue-500 bg-blue-50'
                              : isUtilgj
                                ? 'slot-utilgjengelig hover:opacity-80'
                                : slot?.klubb_id
                                  ? idrettColor(slot.idrett ?? slot.klubber?.idrett) + ' hover:opacity-80'
                                  : 'hover:bg-green-100'
                            return (
                              <div key={dag}
                                onClick={(e) => {
                                  if (!slot) {
                                    opprettSlotForCell(dag, time, e.ctrlKey || e.metaKey || selectedSlotIds.size > 0)
                                    return
                                  }
                                  if (e.ctrlKey || e.metaKey || selectedSlotIds.size > 0) {
                                    toggleSlotSelection(slot.id)
                                  } else {
                                    openSlotModal(slot)
                                  }
                                }}
                                title={isSelected ? 'Valgt' : isUtilgj ? 'Ikke tilgjengelig' : slot?.klubber?.navn ?? 'Klikk for å opprette slot'}
                                className={`h-9 border-b border-r border-gray-300 last:border-r-0 cursor-pointer transition-colors ${klassen}`}>
                                {isSelected && (
                                  <div className="flex h-full items-center justify-center">
                                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                                  </div>
                                )}
                                {!isSelected && slot?.klubb_id && !isUtilgj && (
                                  <div className="flex h-full items-center px-1.5 overflow-hidden">
                                    <span className="truncate text-[10px] font-semibold">{slot.klubber?.navn}</span>
                                  </div>
                                )}
                                {!isSelected && isUtilgj && (
                                  <div className="flex h-full items-center justify-center">
                                    <span className="text-[9px] font-bold uppercase tracking-tight text-gray-700">×</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Legend — kun de seks forbundene + ledig + ikke tilgjengelig */}
                  <div className="flex gap-3 flex-wrap border-t border-gray-300 bg-gray-100 px-4 py-2">
                    {['kampsport', 'kickboksing', 'boksing', 'fekting', 'bryting', 'judo'].map(k => (
                      <span key={k} className="flex items-center gap-1 text-[10px] font-medium text-gray-800">
                        <span className={`h-2.5 w-2.5 rounded-sm ${idrettColor(k)}`} />
                        {k.charAt(0).toUpperCase() + k.slice(1)}
                      </span>
                    ))}
                    <span className="flex items-center gap-1 text-[10px] font-medium text-gray-800">
                      <span className="h-2.5 w-2.5 rounded-sm bg-white ring-1 ring-gray-400" />Ledig
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-medium text-gray-800">
                      <span className="h-2.5 w-2.5 rounded-sm slot-utilgjengelig" />Ikke tilgjengelig
                    </span>
                  </div>
                </div>

                {/* Bulk action bar */}
                {selectedSlotIds.size > 0 && (
                  <div className="card px-4 py-3 border-blue-300 bg-blue-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-blue-900">
                        {selectedSlotIds.size} slot{selectedSlotIds.size !== 1 ? 's' : ''} valgt ({(selectedSlotIds.size * 0.5).toFixed(1).replace('.0', '')}t)
                      </p>
                      <div className="flex gap-2">
                        <button onClick={selectAllLedige} className="text-[10px] text-blue-700 hover:underline">Velg alle ledige</button>
                        <button onClick={() => setSelectedSlotIds(new Set())} className="text-[10px] text-gray-600 hover:underline">Fjern valg</button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <label className="label mb-1">Tildel klubb</label>
                        <div className="flex gap-2">
                          <select className="input flex-1" value={bulkKlubbId} onChange={e => { setBulkKlubbId(e.target.value); setBulkIdrett('') }}>
                            <option value="">— Velg klubb —</option>
                            {klubber.map(k => (
                              <option key={k.id} value={k.id}>{k.navn}{k.idrett ? ` (${k.idrett})` : ''}</option>
                            ))}
                          </select>
                          {getIdretter(bulkKlubbId).length > 1 && (
                            <select className="input w-36" value={bulkIdrett} onChange={e => setBulkIdrett(e.target.value)}>
                              <option value="">— Idrett —</option>
                              {getIdretter(bulkKlubbId).map(i => (
                                <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
                              ))}
                            </select>
                          )}
                          <button onClick={bulkTildelKlubb} disabled={!bulkKlubbId || bulkSaving} className="btn-primary text-xs whitespace-nowrap">
                            {bulkSaving ? 'Lagrer...' : 'Tildel'}
                          </button>
                        </div>
                      </div>
                      <button onClick={bulkFrigjor} disabled={bulkSaving} className="btn text-xs">Frigjør alle</button>
                      <button onClick={bulkMarkerUtilgjengelig} disabled={bulkSaving} className="btn text-xs">Marker utilgjengelig</button>
                      <button onClick={bulkSlett} disabled={bulkSaving} className="btn btn-danger text-xs">Slett valgte</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TAB COMPONENTS ── */}
      {activeTab === 'kapasitet' && <KapasitetTab haller={hallerState} slots={slots} />}
      {activeTab === 'statistikk' && <StatistikkTab klubber={klubber} slots={slots} />}
      {activeTab === 'soknader' && <SoknaderTab soknader={soknader.filter(s => s.status === 'venter')} onHandleSoknad={handleSoknad} />}
      {activeTab === 'endringer' && <EndringerTab endringer={endringer} onHandleEndring={handleEndring} />}
      {activeTab === 'venteliste' && <VentelisteTab venteliste={venteliste} />}
      {activeTab === 'klubber' && <KlubberTab klubber={klubber} slots={slots} aktivSesong={aktivSesong} />}
      {activeTab === 'registreringer' && <RegistreringerTab />}
      {activeTab === 'kart' && <HallerKart haller={hallerState} />}
      {activeTab === 'logg' && <AuditTab />}

      {/* ── SLOT MODAL (Rediger) ── */}
      {slotModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={() => setSlotModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Rediger slot</p>
              <button onClick={() => setSlotModal(null)} className="text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-700 bg-gray-100 ring-1 ring-gray-300 rounded-lg px-3 py-2">
              {slotModal.haller?.navn} — {slotModal.ukedag.charAt(0).toUpperCase() + slotModal.ukedag.slice(1)} {formatTime(slotModal.fra_kl)}–{formatTime(slotModal.til_kl)}
            </p>

            {slotModal.status === 'utilgjengelig' ? (
              <>
                <div className="rounded-lg bg-gray-100 ring-1 ring-gray-300 px-3 py-3 text-center">
                  <p className="text-sm font-semibold text-gray-900">Ikke tilgjengelig</p>
                  <p className="text-xs text-gray-700 mt-0.5">Tiden er blokkert. Klubber kan ikke søke på den.</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setSlotModal(null)} className="btn">Lukk</button>
                  <button onClick={frigjorSlot} disabled={slotModalSaving} className="btn-primary">
                    {slotModalSaving ? 'Lagrer...' : 'Frigjør (gjør ledig)'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label mb-1.5">Tildelt klubb</label>
                  <select className="input" value={slotModalKlubbId} onChange={e => { setSlotModalKlubbId(e.target.value); setSlotModalIdrett('') }}>
                    <option value="">— Ledig —</option>
                    {klubber.map(k => (
                      <option key={k.id} value={k.id}>{k.navn}{k.idrett ? ` (${k.idrett})` : ''}</option>
                    ))}
                  </select>
                </div>
                {getIdretter(slotModalKlubbId).length > 1 && (
                  <div>
                    <label className="label mb-1.5">Idrett for denne sloten</label>
                    <select className="input" value={slotModalIdrett} onChange={e => setSlotModalIdrett(e.target.value)}>
                      <option value="">— Velg idrett —</option>
                      {getIdretter(slotModalKlubbId).map(i => (
                        <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={markerUtilgjengelig}
                  disabled={slotModalSaving}
                  className="btn w-full text-xs">
                  Marker som utilgjengelig
                </button>
                <div className="flex gap-2 justify-between">
                  <button onClick={slettSlot} className="btn btn-danger text-xs px-3">Slett slot</button>
                  <div className="flex gap-2">
                    <button onClick={() => setSlotModal(null)} className="btn">Avbryt</button>
                    <button onClick={lagreSlot} disabled={slotModalSaving} className="btn-primary">
                      {slotModalSaving ? 'Lagrer...' : 'Lagre'}
                    </button>
                  </div>
                </div>
              </>
            )}
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
                <p className="text-xs text-blue-900 bg-blue-100 ring-1 ring-blue-300 rounded-lg px-3 py-2">
                  {n} blokk{n > 1 ? 'er' : ''} à 30 min ({(n * 0.5).toFixed(1).replace('.0', '')}t totalt)
                </p>
              ) : null
            })()}
            {!nySlotForm.utilgjengelig && (
              <>
                <div>
                  <label className="label mb-1.5">Tildel klubb (valgfritt)</label>
                  <select className="input" value={nySlotForm.klubb_id} onChange={e => setNySlotForm(f => ({ ...f, klubb_id: e.target.value, idrett: '' }))}>
                    <option value="">— Ledig —</option>
                    {klubber.map(k => (
                      <option key={k.id} value={k.id}>{k.navn}{k.idrett ? ` (${k.idrett})` : ''}</option>
                    ))}
                  </select>
                </div>
                {getIdretter(nySlotForm.klubb_id).length > 1 && (
                  <div>
                    <label className="label mb-1.5">Idrett</label>
                    <select className="input" value={nySlotForm.idrett} onChange={e => setNySlotForm(f => ({ ...f, idrett: e.target.value }))}>
                      <option value="">— Velg idrett —</option>
                      {getIdretter(nySlotForm.klubb_id).map(i => (
                        <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={nySlotForm.utilgjengelig}
                onChange={e => setNySlotForm(f => ({ ...f, utilgjengelig: e.target.checked, klubb_id: e.target.checked ? '' : f.klubb_id, idrett: e.target.checked ? '' : f.idrett }))}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-900">Marker som <strong>ikke tilgjengelig</strong> (vedlikehold, fast bruk)</span>
            </label>
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

      {/* ── E-POST TEST MODAL ── */}
      {showEmailTest && <EmailTestModal onClose={() => setShowEmailTest(false)} />}

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
              <div className="flex gap-1.5">
                <input
                  type="url"
                  placeholder="…eller lim inn URL fra nett (https://…)"
                  className="input text-xs flex-1"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const v = (e.target as HTMLInputElement).value.trim()
                      if (v) { hentBildeFraUrl(v); (e.target as HTMLInputElement).value = '' }
                    }
                  }}
                  id="bilde-url-input"
                />
                <button type="button" disabled={uploadingBilde} className="btn text-xs"
                  onClick={() => {
                    const inp = document.getElementById('bilde-url-input') as HTMLInputElement | null
                    const v = inp?.value.trim()
                    if (v) { hentBildeFraUrl(v); if (inp) inp.value = '' }
                  }}>Hent</button>
              </div>
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
