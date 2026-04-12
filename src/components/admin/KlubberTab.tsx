'use client'

import { useState } from 'react'
import type { Klubb, Slot, Sesong } from './types'
import { idrettColor, exportCSV } from './types'

interface Props {
  klubber: Klubb[]
  slots: Slot[]
  aktivSesong: Sesong | null
}

export default function KlubberTab({ klubber: initialKlubber, slots, aktivSesong }: Props) {
  const [klubber, setKlubber] = useState(initialKlubber)
  const [search, setSearch] = useState('')
  const [genererer, setGenererer] = useState<string | null>(null)
  const [testLink, setTestLink] = useState<{ klubb: string; url: string } | null>(null)
  const [editKlubb, setEditKlubb] = useState<Klubb | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const uten_epost = klubber.filter(k => !k.epost).length

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
        k.epost ?? '',
        String(k.medlemstall ?? ''),
        k.andel_barn != null ? String(k.andel_barn) : '',
        String(timerPerUke),
      ]
    })
    exportCSV('klubber-oversikt.csv', headers, rows)
  }

  async function genererTestLenke(klubb: Klubb) {
    if (!aktivSesong) {
      alert('Ingen aktiv sesong — kan ikke generere lenke')
      return
    }
    setGenererer(klubb.id)
    try {
      const res = await fetch('/api/admin/test-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ klubb_id: klubb.id, sesong_id: aktivSesong.id }),
      })
      if (res.ok) {
        const { url } = await res.json()
        setTestLink({ klubb: klubb.navn, url })
      } else {
        const data = await res.json()
        alert(`Feil: ${data.error || 'Kunne ikke generere lenke'}`)
      }
    } finally {
      setGenererer(null)
    }
  }

  async function kopierLenke() {
    if (!testLink) return
    await navigator.clipboard.writeText(testLink.url)
  }

  async function saveKlubb() {
    if (!editKlubb) return
    setEditSaving(true)
    setEditError(null)
    const total = editKlubb.ant_0_5 + editKlubb.ant_6_12 + editKlubb.ant_13_19 + editKlubb.ant_20_25 + editKlubb.ant_26_pluss
    const andel_barn = total > 0 ? Math.round(((editKlubb.ant_0_5 + editKlubb.ant_6_12 + editKlubb.ant_13_19) / total) * 100) / 100 : null
    try {
      const res = await fetch('/api/admin/klubber', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editKlubb.id,
          medlemstall: total || editKlubb.medlemstall,
          andel_barn,
          ant_0_5: editKlubb.ant_0_5,
          ant_6_12: editKlubb.ant_6_12,
          ant_13_19: editKlubb.ant_13_19,
          ant_20_25: editKlubb.ant_20_25,
          ant_26_pluss: editKlubb.ant_26_pluss,
        }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.error ? JSON.stringify(detail.error) : res.statusText)
      }
      const updated = await res.json()
      setKlubber(prev => prev.map(k => k.id === updated.id ? { ...k, ...updated } : k))
      setEditKlubb(null)
    } catch (e: any) {
      setEditError(e.message || 'Noe gikk galt')
    } finally {
      setEditSaving(false)
    }
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
      {uten_epost > 0 && (
        <div className="rounded-lg bg-amber-50 ring-1 ring-inset ring-amber-200 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">⚠ {uten_epost} {uten_epost === 1 ? 'klubb mangler' : 'klubber mangler'} e-post.</span>{' '}
          Disse vil ikke motta varsler om søknader eller tildelinger før e-post er fylt inn.
        </div>
      )}
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
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 text-right">Test</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(k => {
                const timerPerUke = (slots.filter(s => s.klubb_id === k.id).length * 0.5)
                return (
                  <tr key={k.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setEditKlubb({ ...k }); setEditError(null) }}>
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
                    <td className="px-4 py-2.5 text-xs truncate max-w-[180px] hidden sm:table-cell">
                      {k.epost ? (
                        <span className="text-gray-600">{k.epost}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 ring-1 ring-inset ring-amber-300" title="Mangler e-post — klubben kan ikke motta varsler">
                          ⚠ Mangler e-post
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => genererTestLenke(k)}
                        disabled={genererer === k.id || !aktivSesong}
                        className="btn text-[10px] px-2 py-1"
                        title={!aktivSesong ? 'Ingen aktiv sesong' : 'Generer test-lenke'}
                      >
                        {genererer === k.id ? '...' : 'Logg inn'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="border-t border-gray-200 bg-gray-50 px-4 py-2.5 flex items-center justify-between">
            <span className="text-[10px] text-gray-600">
              {klubber.length} klubber totalt
              {uten_epost > 0 && <span className="text-amber-800"> · {uten_epost} uten e-post</span>}
            </span>
            <span className="text-[10px] text-gray-600">{(slots.filter(s => s.klubb_id).length * 0.5).toFixed(0)}t tildelt totalt</span>
          </div>
        </div>
      )}

      {/* Rediger klubb modal */}
      {editKlubb && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={() => setEditKlubb(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Rediger {editKlubb.navn}</p>
              <button onClick={() => setEditKlubb(null)} className="text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-500">Oppdater medlemstall per aldersgruppe (Samrap-tall). Totalt og andel barn beregnes automatisk.</p>
            <div className="grid grid-cols-5 gap-2">
              {([
                { key: 'ant_0_5', label: '0–5 år' },
                { key: 'ant_6_12', label: '6–12 år' },
                { key: 'ant_13_19', label: '13–19 år' },
                { key: 'ant_20_25', label: '20–25 år' },
                { key: 'ant_26_pluss', label: '26+ år' },
              ] as const).map(f => (
                <div key={f.key}>
                  <label className="label text-[10px] mb-1">{f.label}</label>
                  <input
                    type="number"
                    min={0}
                    className="input text-xs"
                    value={editKlubb[f.key] ?? 0}
                    onChange={e => setEditKlubb(k => k ? { ...k, [f.key]: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) } : k)}
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <span>Totalt: <strong>{editKlubb.ant_0_5 + editKlubb.ant_6_12 + editKlubb.ant_13_19 + editKlubb.ant_20_25 + editKlubb.ant_26_pluss}</strong></span>
              <span>Barn (0–19): <strong>{editKlubb.ant_0_5 + editKlubb.ant_6_12 + editKlubb.ant_13_19}</strong></span>
              {(() => {
                const t = editKlubb.ant_0_5 + editKlubb.ant_6_12 + editKlubb.ant_13_19 + editKlubb.ant_20_25 + editKlubb.ant_26_pluss
                return t > 0 ? <span>Andel barn: <strong>{Math.round(((editKlubb.ant_0_5 + editKlubb.ant_6_12 + editKlubb.ant_13_19) / t) * 100)}%</strong></span> : null
              })()}
            </div>
            {editError && <p className="rounded-lg bg-red-100 ring-1 ring-red-300 px-3 py-2 text-xs text-red-900">{editError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditKlubb(null)} className="btn text-xs">Avbryt</button>
              <button onClick={saveKlubb} disabled={editSaving} className="btn-primary text-xs">{editSaving ? 'Lagrer…' : 'Lagre'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Test-lenke modal */}
      {testLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setTestLink(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">Test-lenke for {testLink.klubb}</p>
              <button onClick={() => setTestLink(null)} className="text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <p className="text-xs text-gray-600">
              Åpne denne lenken i et inkognito-vindu eller en annen nettleser for å logge inn som klubben uten å miste din admin-økt.
            </p>
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 break-all text-[11px] font-mono text-gray-800">
              {testLink.url}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={kopierLenke} className="btn text-xs">Kopier lenke</button>
              <a href={testLink.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs">
                Åpne i ny fane
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
