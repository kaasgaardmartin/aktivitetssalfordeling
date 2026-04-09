'use client'

import { useState, useTransition, useEffect } from 'react'
import type { Database } from '@/types/database'
import { idrettColor, TIME_ROWS } from '@/components/admin/types'

type Klubb = Database['public']['Tables']['klubber']['Row']
type Sesong = Database['public']['Tables']['sesonger']['Row']
type Slot = Database['public']['Tables']['tidslots']['Row'] & {
  haller: Database['public']['Tables']['haller']['Row'] | null
}
type Svar = Database['public']['Tables']['svar']['Row']
type ReglerInfo = Database['public']['Tables']['regler_info']['Row'] | null

const UKEDAG_ORDER = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lordag', 'sondag']

function formatTime(t: string) { return t.slice(0, 5) }
function formatUkedag(d: string) { return d.charAt(0).toUpperCase() + d.slice(1) }
function timeToMinutes(t: string) {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

// A block represents a contiguous group of 30-min slots for the same hall + ukedag
interface Block {
  hal_id: string
  hal_navn: string
  ukedag: string
  fra_kl: string  // HH:MM:SS
  til_kl: string  // HH:MM:SS
  varighet_min: number
  slot_ids: string[]  // all the 30-min slot ids in this block
}

function groupSlotsIntoBlocks(slots: Slot[]): Block[] {
  // Sort by hall, ukedag (custom order), then fra_kl
  const sorted = [...slots].sort((a, b) => {
    if (a.hal_id !== b.hal_id) return a.hal_id.localeCompare(b.hal_id)
    const dayDiff = UKEDAG_ORDER.indexOf(a.ukedag) - UKEDAG_ORDER.indexOf(b.ukedag)
    if (dayDiff !== 0) return dayDiff
    return timeToMinutes(a.fra_kl) - timeToMinutes(b.fra_kl)
  })

  const blocks: Block[] = []
  for (const slot of sorted) {
    const last = blocks[blocks.length - 1]
    const isContiguous =
      last &&
      last.hal_id === slot.hal_id &&
      last.ukedag === slot.ukedag &&
      timeToMinutes(last.til_kl) === timeToMinutes(slot.fra_kl)

    if (isContiguous) {
      last.til_kl = slot.til_kl
      last.varighet_min += 30
      last.slot_ids.push(slot.id)
    } else {
      blocks.push({
        hal_id: slot.hal_id,
        hal_navn: slot.haller?.navn ?? 'Ukjent',
        ukedag: slot.ukedag,
        fra_kl: slot.fra_kl,
        til_kl: slot.til_kl,
        varighet_min: 30,
        slot_ids: [slot.id],
      })
    }
  }
  return blocks
}

function formatVarighet(min: number) {
  const t = min / 60
  if (Number.isInteger(t)) return `${t}t`
  return `${t.toFixed(1).replace('.', ',')}t`
}

type BlockStatus = 'uendret' | 'endret' | 'sagt_opp'

function blockStatus(block: Block, svar: Record<string, Svar | { handling: string }>): BlockStatus {
  const statuses = block.slot_ids.map(id => svar[id]?.handling ?? 'bekreft')
  if (statuses.every(s => s === 'si_opp')) return 'sagt_opp'
  if (statuses.some(s => s === 'endre')) return 'endret'
  return 'uendret'
}

export default function KlubbOversikt({
  klubb, sesong, slots, svar: initialSvar, regler,
}: {
  klubb: Klubb
  sesong: Sesong
  slots: Slot[]
  svar: Svar[]
  regler: ReglerInfo
}) {
  const [activeTab, setActiveTab] = useState<'tider' | 'sok' | 'profil' | 'regler'>('tider')
  // savedSvar = det som ligger i databasen (fra initialSvar)
  const [savedSvar, setSavedSvar] = useState<Record<string, Svar | { handling: string }>>(
    Object.fromEntries(initialSvar.map(s => [s.tidslot_id, s]))
  )
  // pendingSvar = lokale, ubekreftede endringer som venter på "Bekreft og lagre"
  const [pendingSvar, setPendingSvar] = useState<Record<string, { handling: 'endre' | 'si_opp' | 'bekreft'; ny_ukedag?: string; ny_fra_kl?: string; ny_til_kl?: string; kommentar?: string }>>({})
  const [allebekreftet, setAllebekreftet] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [changeModal, setChangeModal] = useState<Block | null>(null)
  const [changeForm, setChangeForm] = useState({ ny_ukedag: '', ny_fra_kl: '', ny_til_kl: '', kommentar: '' })

  // Kombinert visning: pending overstyrer saved
  const svar: Record<string, Svar | { handling: string }> = { ...savedSvar, ...pendingSvar }

  // Group all slots into blocks, then group blocks per hall
  const allBlocks = groupSlotsIntoBlocks(slots)
  const hallerMap = new Map<string, { hal_id: string; hal_navn: string; hal: NonNullable<Slot['haller']> | null; blocks: Block[] }>()
  for (const block of allBlocks) {
    if (!hallerMap.has(block.hal_id)) {
      const slot = slots.find(s => s.hal_id === block.hal_id)
      hallerMap.set(block.hal_id, {
        hal_id: block.hal_id,
        hal_navn: block.hal_navn,
        hal: slot?.haller ?? null,
        blocks: [],
      })
    }
    hallerMap.get(block.hal_id)!.blocks.push(block)
  }

  const totalSlots = slots.length
  const totalTimer = totalSlots * 0.5
  const endretCount = allBlocks.filter(b => blockStatus(b, svar) !== 'uendret').length
  const pendingCount = Object.keys(pendingSvar).length

  // Lokal: marker blokk som endret / sagt opp (ingen API-kall)
  function markBlockLocal(block: Block, handling: 'endre' | 'si_opp', extra?: { ny_ukedag?: string; ny_fra_kl?: string; ny_til_kl?: string; kommentar?: string }) {
    setPendingSvar(prev => {
      const next = { ...prev }
      block.slot_ids.forEach(id => { next[id] = { handling, ...extra } })
      return next
    })
    setAllebekreftet(false)
  }

  // Lokal: angre → fjern pending OG hvis saved hadde handling, send bekreft
  function angreBlockLocal(block: Block) {
    setPendingSvar(prev => {
      const next = { ...prev }
      block.slot_ids.forEach(id => {
        // Hvis det allerede er lagret noe ikke-bekreft i db, sett pending til bekreft
        const saved = savedSvar[id]
        if (saved && saved.handling !== 'bekreft') {
          next[id] = { handling: 'bekreft' }
        } else {
          delete next[id]
        }
      })
      return next
    })
    setAllebekreftet(false)
  }

  // Hovedknapp: lagre alt ventende + bekreft alle andre uendret
  async function bekreftOgLagre() {
    setIsSaving(true)
    setSaveError(null)
    try {
      // 1) Send alle pending svar (endre/si_opp/angre→bekreft)
      const pendingEntries = Object.entries(pendingSvar)
      if (pendingEntries.length > 0) {
        const results = await Promise.all(pendingEntries.map(([tidslot_id, v]) =>
          fetch('/api/svar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tidslot_id, ...v }),
          })
        ))
        const failed = results.find(r => !r.ok)
        if (failed) {
          const detail = await failed.json().catch(() => ({}))
          throw new Error(`Klarte ikke lagre endringer: ${detail.error ? JSON.stringify(detail.error) : failed.statusText}`)
        }
      }

      // 2) Bekreft resten (PUT = bekreft alle som ikke har svar)
      const res = await fetch('/api/svar', { method: 'PUT' })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(`Klarte ikke bekrefte resterende tider: ${detail.error ?? res.statusText}`)
      }

      // 3) Flytt pending → saved
      setSavedSvar(prev => {
        const next = { ...prev }
        Object.entries(pendingSvar).forEach(([id, v]) => { next[id] = v as any })
        slots.forEach(s => {
          if (!next[s.id]) next[s.id] = { handling: 'bekreft' }
        })
        return next
      })
      setPendingSvar({})
      setAllebekreftet(true)
    } catch (err: any) {
      setSaveError(err.message || 'Noe gikk galt')
    } finally {
      setIsSaving(false)
    }
  }

  function openEndreModal(block: Block) {
    setChangeModal(block)
    setChangeForm({
      ny_ukedag: block.ukedag,
      ny_fra_kl: formatTime(block.fra_kl),
      ny_til_kl: formatTime(block.til_kl),
      kommentar: '',
    })
  }

  const frist = new Date(sesong.frist)
  const dagerIgjen = Math.ceil((frist.getTime() - Date.now()) / 86400000)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="sticky top-0 z-20 flex h-13 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-white"><path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" /></svg>
          </div>
          <span className="text-sm font-semibold text-gray-900 hidden sm:inline">Aktivitetssaler Oslo</span>
          <span className="h-4 w-px bg-gray-200 hidden sm:inline" />
          <span className="text-sm text-gray-700 truncate">{klubb.navn}</span>
        </div>
        <span className="text-xs text-gray-600 shrink-0 hidden sm:inline">{klubb.idrett}</span>
      </div>

      {/* Nav tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4 md:px-5 overflow-x-auto">
        {(['tider', 'sok', 'profil', 'regler'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            {tab === 'tider' ? 'Mine tider' : tab === 'sok' ? 'Søk mer tid' : tab === 'profil' ? 'Profil' : 'Regler og info'}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-4">

        {/* ── MINE TIDER ── */}
        {activeTab === 'tider' && (
          <>
            {/* Banner */}
            <div className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-gray-900">{sesong.navn}</p>
                  <p className="text-sm text-gray-600 mt-0.5">Gjennomgå tidene dine — marker det du ønsker å endre eller si opp, og lagre nederst.</p>
                </div>
                <span className={`badge whitespace-nowrap ${dagerIgjen < 5 ? 'bg-red-100 text-red-900 ring-1 ring-red-300' : 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'}`}>
                  Frist: {frist.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { val: hallerMap.size, lbl: 'Lokaler' },
                { val: formatVarighet(totalTimer * 60), lbl: 'Timer/uke' },
                { val: endretCount, lbl: 'Endringer' },
              ].map(s => (
                <div key={s.lbl} className="card px-4 py-3">
                  <p className="text-2xl font-semibold tabular-nums text-gray-900">{s.val}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{s.lbl}</p>
                </div>
              ))}
            </div>

            {/* Hall cards */}
            {Array.from(hallerMap.values()).map(({ hal_id, hal_navn, hal, blocks }) => {
              const totalMin = blocks.reduce((sum, b) => sum + b.varighet_min, 0)
              return (
                <div key={hal_id} className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{hal_navn}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {hal?.underlag && <span className="badge bg-gray-100 text-gray-600">{hal.underlag}</span>}
                          {hal?.adresse && <span className="badge bg-gray-100 text-gray-600">{hal.adresse}</span>}
                          {hal?.stengedager && <span className="badge bg-amber-100 text-amber-900 ring-1 ring-amber-300">Stengt: {hal.stengedager}</span>}
                        </div>
                        {hal?.merknader && (
                          <p className="mt-1.5 text-xs text-gray-600">{hal.merknader}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-semibold tabular-nums text-gray-900">{formatVarighet(totalMin)}</p>
                        <p className="text-[10px] text-gray-600">{blocks.length} økt{blocks.length !== 1 ? 'er' : ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {blocks.map((block) => {
                      const status = blockStatus(block, svar)
                      const blockKey = block.slot_ids[0]
                      const hasPending = block.slot_ids.some(id => pendingSvar[id])
                      return (
                        <div key={blockKey} className={`px-4 py-3 ${hasPending ? 'bg-amber-100/60' : ''}`}>
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900">{formatUkedag(block.ukedag)}</span>
                                <span className="font-mono text-sm text-gray-700">{formatTime(block.fra_kl)}–{formatTime(block.til_kl)}</span>
                                <span className="text-xs text-gray-600">({formatVarighet(block.varighet_min)})</span>
                              </div>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {status === 'uendret' && <span className="badge bg-green-100 text-green-900 ring-1 ring-green-300">Uendret</span>}
                                {status === 'endret' && <span className="badge bg-blue-100 text-blue-900 ring-1 ring-blue-300">Endret</span>}
                                {status === 'sagt_opp' && <span className="badge bg-gray-200 text-gray-900 ring-1 ring-gray-400">Sagt opp</span>}
                                {hasPending && <span className="badge bg-amber-200 text-amber-900 ring-1 ring-amber-400">Ulagret</span>}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0">
                              {status === 'uendret' ? (
                                <>
                                  <button
                                    onClick={() => openEndreModal(block)}
                                    className="btn text-xs px-3 py-1"
                                  >
                                    Endre
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm(`Si opp ${formatUkedag(block.ukedag)} ${formatTime(block.fra_kl)}–${formatTime(block.til_kl)}?`)) {
                                        markBlockLocal(block, 'si_opp')
                                      }
                                    }}
                                    className="btn btn-danger text-xs px-3 py-1"
                                  >
                                    Si opp
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => angreBlockLocal(block)}
                                  className="btn text-xs px-3 py-1"
                                >
                                  Angre
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-2 border-t border-gray-200 px-4 py-2.5">
                    <button onClick={() => setActiveTab('sok')} className="btn text-xs">+ Søk om mer tid</button>
                  </div>
                </div>
              )
            })}

            {hallerMap.size === 0 && (
              <div className="card p-8 text-center">
                <p className="text-sm text-gray-600">Ingen treningstider tildelt for denne sesongen.</p>
              </div>
            )}

            {/* Bunn-panel: Bekreft og lagre */}
            {hallerMap.size > 0 && (
              <div className="card p-5 space-y-3 border-gray-300">
                <div>
                  <p className="font-semibold text-gray-900">Ferdig med gjennomgangen?</p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {pendingCount > 0
                      ? <>Du har <strong>{pendingCount}</strong> ulagrede {pendingCount === 1 ? 'endring' : 'endringer'}. Klikk under for å sende disse og bekrefte resten av tidene som uendret.</>
                      : allebekreftet
                        ? 'Alle tider er bekreftet og lagret.'
                        : 'Ingen endringer lagt inn. Klikk under for å bekrefte alle tider uendret.'}
                  </p>
                </div>
                {saveError && (
                  <div className="rounded-lg bg-red-100 border border-red-300 px-3 py-2 text-sm text-red-900">
                    {saveError}
                  </div>
                )}
                <button
                  onClick={bekreftOgLagre}
                  disabled={isSaving || (allebekreftet && pendingCount === 0)}
                  className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                    allebekreftet && pendingCount === 0
                      ? 'bg-green-800 text-green-100 cursor-default'
                      : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60'
                  }`}
                >
                  {isSaving
                    ? 'Lagrer...'
                    : allebekreftet && pendingCount === 0
                      ? '✓ Alt er lagret'
                      : pendingCount > 0
                        ? `✓ Lagre ${pendingCount} ${pendingCount === 1 ? 'endring' : 'endringer'} og bekreft resten`
                        : '✓ Bekreft alle tider uendret'}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── SØK MER TID ── */}
        {activeTab === 'sok' && (
          <SokMerTid sesongId={sesong.id} />
        )}

        {/* ── PROFIL ── */}
        {activeTab === 'profil' && (
          <KlubbProfil klubbNavn={klubb.navn} />
        )}

        {/* ── REGLER ── */}
        {activeTab === 'regler' && (
          <div className="card p-6">
            <p className="font-semibold text-gray-900 mb-1">Regler og retningslinjer</p>
            {regler?.oppdatert_at && (
              <p className="text-xs text-gray-600 mb-4">
                Sist oppdatert: {new Date(regler.oppdatert_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
            <div className="prose prose-sm text-gray-600 whitespace-pre-wrap">
              {regler?.innhold || 'Ingen informasjon er lagt inn ennå.'}
            </div>
          </div>
        )}
      </div>

      {/* ── ENDRE MODAL ── */}
      {changeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={() => setChangeModal(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Foreslå endring</p>
              <button onClick={() => setChangeModal(null)} className="text-gray-600 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              {changeModal.hal_navn} — {formatUkedag(changeModal.ukedag)} {formatTime(changeModal.fra_kl)}–{formatTime(changeModal.til_kl)} ({formatVarighet(changeModal.varighet_min)})
            </p>
            <div className="space-y-3">
              <div>
                <label className="label mb-1">Ønsket ukedag</label>
                <select className="input" value={changeForm.ny_ukedag} onChange={e => setChangeForm(f => ({ ...f, ny_ukedag: e.target.value }))}>
                  {UKEDAG_ORDER.slice(0, 5).map(d => <option key={d} value={d}>{formatUkedag(d)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1">Fra kl.</label>
                  <input type="time" step="1800" className="input" value={changeForm.ny_fra_kl} onChange={e => setChangeForm(f => ({ ...f, ny_fra_kl: e.target.value }))} />
                </div>
                <div>
                  <label className="label mb-1">Til kl.</label>
                  <input type="time" step="1800" className="input" value={changeForm.ny_til_kl} onChange={e => setChangeForm(f => ({ ...f, ny_til_kl: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label mb-1">Kommentar (valgfritt)</label>
                <textarea className="input h-16 resize-none" placeholder="Forklar ønsket endring..." value={changeForm.kommentar} onChange={e => setChangeForm(f => ({ ...f, kommentar: e.target.value }))} />
              </div>
            </div>
            <p className="text-[11px] text-gray-600">
              Endringen gjelder hele blokken. Den sendes til administrator når du klikker "Bekreft og lagre" nederst.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setChangeModal(null)} className="btn">Avbryt</button>
              <button onClick={() => {
                if (!changeModal) return
                markBlockLocal(changeModal, 'endre', {
                  ny_ukedag: changeForm.ny_ukedag,
                  ny_fra_kl: changeForm.ny_fra_kl + ':00',
                  ny_til_kl: changeForm.ny_til_kl + ':00',
                  kommentar: changeForm.kommentar,
                })
                setChangeModal(null)
              }} className="btn-primary">Legg til endring</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Søk mer tid: hall-grid med klikkbare ledige celler ──
interface GridSlot {
  id: string
  hal_id: string
  ukedag: string
  fra_kl: string
  til_kl: string
  klubb_id: string | null
  status: 'ledig' | 'utilgjengelig'
  haller: { id: string; navn: string } | null
  klubber: { id: string; navn: string; idrett: string | null } | null
}

const GRID_DAYS = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag'] as const
const DAG_KORT: Record<string, string> = { mandag: 'Man', tirsdag: 'Tir', onsdag: 'Ons', torsdag: 'Tor', fredag: 'Fre' }

function SokMerTid({ sesongId }: { sesongId: string }) {
  const [slots, setSlots] = useState<GridSlot[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [selectedHalId, setSelectedHalId] = useState<string | null>(null)
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set())
  const [form, setForm] = useState({ gruppe: 'barn', begrunnelse: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [feil, setFeil] = useState<string | null>(null)

  async function loadSlots() {
    setLoading(true)
    const res = await fetch(`/api/tidslots?sesong_id=${sesongId}`)
    const data: GridSlot[] = await res.json()
    setSlots(data)
    setLoaded(true)
    setLoading(false)
    // Velg første hall som har slots
    const firstHal = data.find(s => s.haller)?.haller?.id ?? null
    if (firstHal) setSelectedHalId(firstHal)
  }

  if (!loaded) {
    return (
      <div className="card p-6 text-center space-y-3">
        <p className="text-sm text-gray-600">Klikk under for å se hall-oversikten — tildelte, ledige og blokkerte tider.</p>
        <button onClick={loadSlots} disabled={loading} className="btn-primary">
          {loading ? 'Laster…' : 'Vis hall-oversikt'}
        </button>
      </div>
    )
  }

  // Unike haller fra slots
  const haller = Array.from(
    new Map(slots.filter(s => s.haller).map(s => [s.haller!.id, s.haller!])).values()
  ).sort((a, b) => a.navn.localeCompare(b.navn))

  const halSlots = slots.filter(s => s.hal_id === selectedHalId)
  const selectedHal = haller.find(h => h.id === selectedHalId)

  function toggleSlot(slot: GridSlot) {
    if (slot.status === 'utilgjengelig' || slot.klubb_id) return
    setSelectedSlotIds(prev => {
      const next = new Set(prev)
      if (next.has(slot.id)) next.delete(slot.id)
      else next.add(slot.id)
      return next
    })
    setSent(false)
    setFeil(null)
  }

  // Skift hall → tøm valg
  function pickHall(id: string) {
    setSelectedHalId(id)
    setSelectedSlotIds(new Set())
    setSent(false)
    setFeil(null)
  }

  async function sendSoknad() {
    if (selectedSlotIds.size === 0) return
    setSending(true)
    setFeil(null)
    const ids = Array.from(selectedSlotIds)
    const results = await Promise.all(ids.map(slotId =>
      fetch('/api/soknader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tidslot_id: slotId, gruppe: form.gruppe, begrunnelse: form.begrunnelse }),
      })
    ))
    const ok = results.every(r => r.ok)
    if (ok) {
      setSent(true)
      setSelectedSlotIds(new Set())
    } else {
      const firstError = await results.find(r => !r.ok)?.json().catch(() => null)
      setFeil(firstError?.error ?? 'Noe gikk galt')
    }
    setSending(false)
  }

  // Beregn antall slots per status (for header)
  const ledigeAntall = halSlots.filter(s => !s.klubb_id && s.status !== 'utilgjengelig').length
  const tildelteAntall = halSlots.filter(s => s.klubb_id).length
  const blokkertAntall = halSlots.filter(s => s.status === 'utilgjengelig').length

  return (
    <div className="space-y-4">
      {/* Hall-velger */}
      {haller.length > 1 && (
        <div className="card p-3">
          <p className="label mb-2">Velg hall</p>
          <div className="flex gap-1.5 flex-wrap">
            {haller.map(h => (
              <button key={h.id} onClick={() => pickHall(h.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                  selectedHalId === h.id ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}>
                {h.navn}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedHal && (
        <>
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <p className="font-semibold text-gray-900">{selectedHal.navn}</p>
              <p className="text-xs text-gray-700">
                {tildelteAntall * 0.5}t tildelt · {ledigeAntall * 0.5}t ledig{blokkertAntall > 0 ? ` · ${blokkertAntall * 0.5}t blokkert` : ''}
              </p>
            </div>
            {selectedSlotIds.size > 0 && (
              <span className="badge bg-blue-100 text-blue-900 ring-1 ring-blue-300">
                {selectedSlotIds.size} valgt ({selectedSlotIds.size * 0.5}t)
              </span>
            )}
          </div>

          {/* Grid */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <div className="grid min-w-[500px]" style={{ gridTemplateColumns: '60px repeat(5, 1fr)' }}>
                <div className="border-b border-r border-gray-300 bg-gray-100 p-2" />
                {GRID_DAYS.map(d => (
                  <div key={d} className="border-b border-r border-gray-300 bg-gray-100 px-2 py-2 text-center text-xs font-bold uppercase tracking-wider text-gray-800 last:border-r-0">{DAG_KORT[d]}</div>
                ))}
                {TIME_ROWS.map(time => (
                  <div key={time} className="contents">
                    <div className="border-b border-r border-gray-300 bg-gray-100 px-2 py-0 flex items-center">
                      <span className="text-[10px] font-mono font-semibold text-gray-800">{time}</span>
                    </div>
                    {GRID_DAYS.map(dag => {
                      const slot = halSlots.find(s => s.ukedag === dag && formatTime(s.fra_kl) === time)
                      const isUtilgj = slot?.status === 'utilgjengelig'
                      const isTildelt = !!slot?.klubb_id
                      const isLedig = slot && !isTildelt && !isUtilgj
                      const isSelected = slot && selectedSlotIds.has(slot.id)
                      const klassen = isUtilgj
                        ? 'slot-utilgjengelig cursor-not-allowed'
                        : isTildelt
                          ? idrettColor(slot?.idrett ?? slot?.klubber?.idrett) + ' cursor-not-allowed'
                          : isLedig
                            ? (isSelected ? 'bg-blue-200 ring-2 ring-inset ring-blue-600 cursor-pointer' : 'bg-white hover:bg-blue-50 cursor-pointer')
                            : ''
                      return (
                        <div key={dag}
                          onClick={() => slot && toggleSlot(slot)}
                          title={isUtilgj ? 'Ikke tilgjengelig' : isTildelt ? slot?.klubber?.navn ?? '' : isLedig ? 'Klikk for å velge' : ''}
                          className={`h-9 border-b border-r border-gray-300 last:border-r-0 transition-colors ${klassen}`}>
                          {isTildelt && (
                            <div className="flex h-full items-center px-1.5 overflow-hidden">
                              <span className="truncate text-[10px] font-semibold">{slot?.klubber?.navn?.split(' ')[0]}</span>
                            </div>
                          )}
                          {isUtilgj && (
                            <div className="flex h-full items-center justify-center">
                              <span className="text-[9px] font-bold text-gray-700">×</span>
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
        </>
      )}

      {/* Søknadsskjema */}
      {selectedSlotIds.size > 0 && !sent && (
        <div className="card overflow-hidden">
          <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
            <p className="font-semibold text-sm text-gray-900">Send søknad</p>
            <p className="text-xs text-gray-700 mt-0.5">
              {selectedSlotIds.size} valgt{pl('e', selectedSlotIds.size)} blokk{pl('er', selectedSlotIds.size)} ({selectedSlotIds.size * 0.5}t totalt)
            </p>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="label mb-1.5">Hvem er tiden til?</label>
              <div className="grid grid-cols-3 gap-2">
                {(['barn', 'voksne', 'begge'] as const).map(g => (
                  <button key={g} onClick={() => setForm(f => ({ ...f, gruppe: g }))}
                    className={`rounded-lg border py-2 text-sm font-medium transition-colors ${form.gruppe === g ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label mb-1.5">Begrunnelse</label>
              <textarea className="input h-20 resize-none" placeholder="Beskriv behovet kort…" value={form.begrunnelse} onChange={e => setForm(f => ({ ...f, begrunnelse: e.target.value }))} />
            </div>
            {feil && <p className="rounded-lg bg-red-100 ring-1 ring-red-300 px-3 py-2 text-sm text-red-900">{feil}</p>}
            <button onClick={sendSoknad} disabled={sending || form.begrunnelse.trim().length < 10} className="btn-primary w-full">
              {sending ? 'Sender…' : `Send søknad (${selectedSlotIds.size} blokk${pl('er', selectedSlotIds.size)})`}
            </button>
          </div>
        </div>
      )}

      {sent && (
        <div className="rounded-xl border border-green-300 bg-green-100 p-5 text-center">
          <p className="font-semibold text-green-900">Søknad sendt!</p>
          <p className="text-sm text-green-800 mt-1">Admin vil behandle søknaden og du får beskjed.</p>
        </div>
      )}
    </div>
  )
}

// Liten flertallshjelper: pl('er', 1) → '', pl('er', 2) → 'er'
function pl(suffix: string, n: number) { return n === 1 ? '' : suffix }

// ── Klubbprofil-komponent ──
interface KlubbProfilData {
  id: string
  navn: string
  idrett: string | null
  epost: string
  kontaktperson: string | null
  telefon: string | null
  medlemstall: number | null
  andel_barn: number | null
}

function KlubbProfil({ klubbNavn }: { klubbNavn: string }) {
  const [data, setData] = useState<KlubbProfilData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/klubb/profil')
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="card p-6 text-center text-sm text-gray-600">Laster profil…</div>
  if (!data) return <div className="card p-6 text-center text-sm text-gray-600">Kunne ikke laste profil.</div>

  async function save() {
    if (!data) return
    setSaving(true)
    setErr(null)
    try {
      const res = await fetch('/api/klubb/profil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kontaktperson: data.kontaktperson || null,
          epost: data.epost,
          telefon: data.telefon || null,
          medlemstall: data.medlemstall ?? null,
          andel_barn: data.andel_barn ?? null,
        }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(typeof detail.error === 'string' ? detail.error : 'Klarte ikke lagre')
      }
      setSavedAt(new Date())
    } catch (e: any) {
      setErr(e.message || 'Noe gikk galt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <p className="font-semibold text-gray-900">{klubbNavn}</p>
        <p className="text-xs text-gray-600 mt-0.5">{data.idrett ?? 'Idrett ikke satt'}</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="label mb-1.5">Kontaktperson</label>
          <input
            className="input"
            placeholder="Navn på kontaktperson"
            value={data.kontaktperson ?? ''}
            onChange={e => setData(d => d ? { ...d, kontaktperson: e.target.value } : d)}
          />
        </div>
        <div>
          <label className="label mb-1.5">E-post</label>
          <input
            type="email"
            className="input"
            value={data.epost ?? ''}
            onChange={e => setData(d => d ? { ...d, epost: e.target.value } : d)}
          />
          <p className="text-[11px] text-gray-600 mt-1">Brukes til innlogging og varslinger.</p>
        </div>
        <div>
          <label className="label mb-1.5">Telefon</label>
          <input
            className="input"
            placeholder="+47 ..."
            value={data.telefon ?? ''}
            onChange={e => setData(d => d ? { ...d, telefon: e.target.value } : d)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label mb-1.5">Medlemstall</label>
            <input
              type="number"
              min={0}
              className="input"
              value={data.medlemstall ?? ''}
              onChange={e => setData(d => d ? { ...d, medlemstall: e.target.value === '' ? null : Number(e.target.value) } : d)}
            />
          </div>
          <div>
            <label className="label mb-1.5">Andel barn (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input"
              value={data.andel_barn == null ? '' : Math.round(data.andel_barn * 100)}
              onChange={e => {
                const v = e.target.value
                setData(d => d ? { ...d, andel_barn: v === '' ? null : Math.max(0, Math.min(100, Number(v))) / 100 } : d)
              }}
            />
          </div>
        </div>
      </div>

      {err && (
        <div className="rounded-lg bg-red-100 border border-red-300 px-3 py-2 text-sm text-red-900">{err}</div>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-gray-600">
          {savedAt ? `✓ Lagret ${savedAt.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}` : 'Ikke lagret'}
        </span>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Lagrer…' : 'Lagre profil'}
        </button>
      </div>
    </div>
  )
}
