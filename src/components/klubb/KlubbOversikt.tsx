'use client'

import { useState, useTransition } from 'react'
import type { Database } from '@/types/database'

type Klubb = Database['public']['Tables']['klubber']['Row']
type Sesong = Database['public']['Tables']['sesonger']['Row']
type Slot = Database['public']['Tables']['tidslots']['Row'] & {
  haller: Database['public']['Tables']['haller']['Row'] | null
}
type Svar = Database['public']['Tables']['svar']['Row']
type ReglerInfo = Database['public']['Tables']['regler_info']['Row'] | null

const UKEDAG_ORDER = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag']

function formatTime(t: string) { return t.slice(0, 5) }
function formatUkedag(d: string) { return d.charAt(0).toUpperCase() + d.slice(1) }

export default function KlubbOversikt({
  klubb, sesong, slots, svar: initialSvar, regler,
}: {
  klubb: Klubb
  sesong: Sesong
  slots: Slot[]
  svar: Svar[]
  regler: ReglerInfo
}) {
  const [activeTab, setActiveTab] = useState<'tider' | 'sok' | 'regler'>('tider')
  const [svar, setSvar] = useState<Record<string, Svar>>(
    Object.fromEntries(initialSvar.map(s => [s.tidslot_id, s]))
  )
  const [allebekreftet, setAllebekreftet] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [changeModal, setChangeModal] = useState<Slot | null>(null)
  const [changeForm, setChangeForm] = useState({ ny_ukedag: '', ny_fra_kl: '', ny_til_kl: '', kommentar: '' })

  // Group slots by hall
  const hallerMap = new Map<string, { hal: NonNullable<Slot['haller']>; slots: Slot[] }>()
  slots.forEach(s => {
    if (!s.haller) return
    if (!hallerMap.has(s.hal_id)) hallerMap.set(s.hal_id, { hal: s.haller, slots: [] })
    hallerMap.get(s.hal_id)!.slots.push(s)
  })

  const totalSlots = slots.length
  const endretCount = Object.values(svar).filter(s => s.handling !== 'bekreft').length

  async function bekreftAlle() {
    startTransition(async () => {
      const res = await fetch('/api/svar', { method: 'PUT' })
      if (res.ok) {
        const newSvar: Record<string, Svar> = {}
        slots.forEach(s => {
          newSvar[s.id] = { ...({} as Svar), tidslot_id: s.id, handling: 'bekreft' }
        })
        setSvar(newSvar)
        setAllebekreftet(true)
      }
    })
  }

  async function sendSvar(slotId: string, handling: 'bekreft' | 'endre' | 'si_opp', extra?: object) {
    const res = await fetch('/api/svar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tidslot_id: slotId, handling, ...extra }),
    })
    if (res.ok) {
      setSvar(prev => ({ ...prev, [slotId]: { ...({} as Svar), tidslot_id: slotId, handling, ...extra } }))
    }
  }

  const frist = new Date(sesong.frist)
  const dagerIgjen = Math.ceil((frist.getTime() - Date.now()) / 86400000)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="sticky top-0 z-20 flex h-13 items-center justify-between border-b border-gray-200 bg-white px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-white"><path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" /></svg>
          </div>
          <span className="text-sm font-semibold text-gray-900">Aktivitetssaler Oslo</span>
          <span className="h-4 w-px bg-gray-200" />
          <span className="text-sm text-gray-500">{klubb.navn}</span>
        </div>
        <span className="text-xs text-gray-400">{klubb.idrett}</span>
      </div>

      {/* Nav tabs */}
      <div className="flex border-b border-gray-200 bg-white px-5">
        {(['tider', 'sok', 'regler'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'tider' ? 'Mine tider' : tab === 'sok' ? 'Søk mer tid' : 'Regler og info'}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-4">

        {/* ── MINE TIDER ── */}
        {activeTab === 'tider' && (
          <>
            {/* Banner */}
            <div className="card p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-base font-semibold text-gray-900">{sesong.navn}</p>
                  <p className="text-sm text-gray-500 mt-0.5">Gjennomgå tidene dine — endre det du ønsker, bekreft resten</p>
                </div>
                <span className={`badge whitespace-nowrap ${dagerIgjen < 5 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                  Frist: {frist.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}
                </span>
              </div>
              <button
                onClick={bekreftAlle}
                disabled={isPending || allebekreftet}
                className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                  allebekreftet
                    ? 'bg-green-800 text-green-100 cursor-default'
                    : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60'
                }`}
              >
                {allebekreftet ? '✓ Alle tider bekreftet' : isPending ? 'Bekrefter...' : '✓ Bekreft alle tider uendret'}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { val: hallerMap.size, lbl: 'Lokaler' },
                { val: `${(totalSlots * 0.5).toFixed(0)}t`, lbl: 'Timer/uke' },
                { val: endretCount, lbl: 'Endringer' },
              ].map(s => (
                <div key={s.lbl} className="card px-4 py-3">
                  <p className="text-2xl font-semibold tabular-nums text-gray-900">{s.val}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.lbl}</p>
                </div>
              ))}
            </div>

            {/* Hall cards */}
            {Array.from(hallerMap.values()).map(({ hal, slots: hSlots }) => (
              <div key={hal.id} className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-semibold text-gray-900">{hal.navn}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {hal.underlag && <span className="badge bg-gray-100 text-gray-600">{hal.underlag}</span>}
                    {hal.stengedager && <span className="badge bg-amber-50 text-amber-700">Stengt: {hal.stengedager}</span>}
                  </div>
                  {hal.merknader && (
                    <p className="mt-1.5 text-xs text-gray-500">{hal.merknader}</p>
                  )}
                </div>
                <div className="divide-y divide-gray-100">
                  {hSlots
                    .sort((a, b) => UKEDAG_ORDER.indexOf(a.ukedag) - UKEDAG_ORDER.indexOf(b.ukedag))
                    .map(slot => {
                      const s = svar[slot.id]
                      return (
                        <div key={slot.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="w-20 text-sm font-medium text-gray-900">{formatUkedag(slot.ukedag)}</span>
                          <span className="w-24 font-mono text-xs text-gray-500">{formatTime(slot.fra_kl)}–{formatTime(slot.til_kl)}</span>
                          <span className="flex-1 text-sm text-gray-500">{klubb.idrett}</span>
                          <div className="flex gap-1.5">
                            {!s || s.handling === 'bekreft' ? (
                              <>
                                <span className="badge bg-green-50 text-green-700">Uendret</span>
                                <button onClick={() => { setChangeModal(slot); setChangeForm({ ny_ukedag: slot.ukedag, ny_fra_kl: formatTime(slot.fra_kl), ny_til_kl: formatTime(slot.til_kl), kommentar: '' }) }} className="btn text-xs px-2 py-1">Endre</button>
                                <button onClick={() => sendSvar(slot.id, 'si_opp')} className="btn btn-danger text-xs px-2 py-1">Si opp</button>
                              </>
                            ) : s.handling === 'endre' ? (
                              <span className="badge bg-blue-50 text-blue-700">Endret</span>
                            ) : (
                              <span className="badge bg-gray-100 text-gray-500">Sagt opp</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
                <div className="flex gap-2 border-t border-gray-100 px-4 py-2.5">
                  <button onClick={() => setActiveTab('sok')} className="btn text-xs">+ Søk om mer tid</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── SØK MER TID ── */}
        {activeTab === 'sok' && (
          <SokMerTid sesongId={sesong.id} />
        )}

        {/* ── REGLER ── */}
        {activeTab === 'regler' && (
          <div className="card p-6">
            <p className="font-semibold text-gray-900 mb-1">Regler og retningslinjer</p>
            {regler?.oppdatert_at && (
              <p className="text-xs text-gray-400 mb-4">
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Endre tid</p>
              <button onClick={() => setChangeModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              {changeModal.haller?.navn} — {formatUkedag(changeModal.ukedag)} {formatTime(changeModal.fra_kl)}–{formatTime(changeModal.til_kl)}
            </p>
            <div className="space-y-3">
              <div>
                <label className="label mb-1">Ønsket ukedag</label>
                <select className="input" value={changeForm.ny_ukedag} onChange={e => setChangeForm(f => ({ ...f, ny_ukedag: e.target.value }))}>
                  {UKEDAG_ORDER.map(d => <option key={d} value={d}>{formatUkedag(d)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1">Fra kl.</label>
                  <select className="input" value={changeForm.ny_fra_kl} onChange={e => setChangeForm(f => ({ ...f, ny_fra_kl: e.target.value }))}>
                    {['15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label mb-1">Til kl.</label>
                  <select className="input" value={changeForm.ny_til_kl} onChange={e => setChangeForm(f => ({ ...f, ny_til_kl: e.target.value }))}>
                    {['15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label mb-1">Kommentar (valgfritt)</label>
                <textarea className="input h-16 resize-none" placeholder="Forklar ønsket endring..." value={changeForm.kommentar} onChange={e => setChangeForm(f => ({ ...f, kommentar: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setChangeModal(null)} className="btn">Avbryt</button>
              <button onClick={async () => {
                await sendSvar(changeModal.id, 'endre', {
                  ny_ukedag: changeForm.ny_ukedag,
                  ny_fra_kl: changeForm.ny_fra_kl + ':00',
                  ny_til_kl: changeForm.ny_til_kl + ':00',
                  kommentar: changeForm.kommentar,
                })
                setChangeModal(null)
              }} className="btn-primary">Lagre endring</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Søk mer tid subcomponent ──
function SokMerTid({ sesongId }: { sesongId: string }) {
  const [slots, setSlots] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [dagFilter, setDagFilter] = useState('alle')
  const [selected, setSelected] = useState<any | null>(null)
  const [form, setForm] = useState({ gruppe: 'barn', begrunnelse: '' })
  const [sent, setSent] = useState(false)

  async function loadSlots() {
    setLoading(true)
    const res = await fetch(`/api/tidslots?sesong_id=${sesongId}&ledig=true`)
    const data = await res.json()
    setSlots(data)
    setLoaded(true)
    setLoading(false)
  }

  if (!loaded) {
    return (
      <div className="card p-6 text-center space-y-3">
        <p className="text-sm text-gray-600">Klikk under for å se ledige treningstider på tvers av alle saler.</p>
        <button onClick={loadSlots} disabled={loading} className="btn-primary">
          {loading ? 'Laster...' : 'Vis ledige tider'}
        </button>
      </div>
    )
  }

  const DAYS = ['alle', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag']
  const filtered = dagFilter === 'alle' ? slots : slots.filter(s => s.ukedag === dagFilter)

  return (
    <div className="space-y-4">
      {/* Day filter */}
      <div className="card p-3 flex items-center gap-2 flex-wrap">
        <span className="label">Dag</span>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(d => (
            <button key={d} onClick={() => setDagFilter(d)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                dagFilter === d ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {d === 'alle' ? 'Alle' : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-gray-400">{filtered.length} ledige</span>
      </div>

      {/* Slot list */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">Ingen ledige slots</p>
      ) : filtered.map((slot: any) => (
        <div key={slot.id}
          onClick={() => setSelected(selected?.id === slot.id ? null : slot)}
          className={`card p-4 cursor-pointer transition-all ${selected?.id === slot.id ? 'border-gray-900' : 'hover:border-gray-300'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-gray-900">{slot.haller?.navn}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-xs font-mono text-gray-500">{slot.ukedag.charAt(0).toUpperCase() + slot.ukedag.slice(1)}  {formatTime(slot.fra_kl)}–{formatTime(slot.til_kl)}</span>
                {slot.haller?.underlag && <span className="badge bg-gray-100 text-gray-600">{slot.haller.underlag}</span>}
              </div>
            </div>
            <span className={`text-xs font-medium ${selected?.id === slot.id ? 'text-gray-900' : 'text-gray-400'}`}>
              {selected?.id === slot.id ? 'Valgt' : 'Velg'}
            </span>
          </div>
        </div>
      ))}

      {/* Application form */}
      {selected && !sent && (
        <div className="card overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-sm text-gray-900">Send søknad</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {selected.haller?.navn} — {selected.ukedag.charAt(0).toUpperCase() + selected.ukedag.slice(1)} {formatTime(selected.fra_kl)}–{formatTime(selected.til_kl)}
            </p>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="label mb-1.5">Hvem er tiden til?</label>
              <div className="grid grid-cols-3 gap-2">
                {(['barn', 'voksne', 'begge'] as const).map(g => (
                  <button key={g} onClick={() => setForm(f => ({ ...f, gruppe: g }))}
                    className={`rounded-lg border py-2 text-sm font-medium transition-colors ${form.gruppe === g ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label mb-1.5">Begrunnelse</label>
              <textarea className="input h-20 resize-none" placeholder="Beskriv behovet kort..." value={form.begrunnelse} onChange={e => setForm(f => ({ ...f, begrunnelse: e.target.value }))} />
            </div>
            <button onClick={async () => {
              const res = await fetch('/api/soknader', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tidslot_id: selected.id, gruppe: form.gruppe, begrunnelse: form.begrunnelse }),
              })
              if (res.ok) setSent(true)
            }} className="btn-primary w-full">Send søknad</button>
          </div>
        </div>
      )}

      {sent && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
          <p className="font-semibold text-green-800">Søknad sendt!</p>
          <p className="text-sm text-green-700 mt-1">Admin vil behandle søknaden og du får beskjed.</p>
        </div>
      )}
    </div>
  )
}
