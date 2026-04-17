'use client'

import { useState } from 'react'

// Idretter som allerede er representert i fordelingen.
// «Annet» åpner et fritekstfelt.
const IDRETT_VALG = [
  'Boksing',
  'Bryting',
  'Fekting',
  'Judo',
  'Kampsport',
  'Kickboksing',
  'Paraidrett',
  'Dans',
  'Bordtennis',
] as const

export default function RegistrerClient() {
  const [form, setForm] = useState({
    navn: '', idrett: '', epost: '', kontaktperson: '', telefon: '',
    organisasjonsnummer: '', beskrivelse: '',
  })
  const [idrettValg, setIdrettValg] = useState<string>('')
  const [idrettAnnet, setIdrettAnnet] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const idrett = idrettValg === 'Annet' ? idrettAnnet.trim() : idrettValg
    if (!idrett) {
      setError('Velg idrett')
      return
    }
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/klubb/registrer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, idrett }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.error === 'string' ? data.error : 'Kunne ikke sende søknad')
      }
      setDone(true)
    } catch (e: any) {
      setError(e.message || 'Noe gikk galt')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="card max-w-md w-full p-6 text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">✓</div>
          <h1 className="text-lg font-semibold">Søknad mottatt</h1>
          <p className="text-sm text-gray-600">
            Takk! Idrettssekretariatet vil vurdere søknaden din og kontakte deg på <strong>{form.epost}</strong> så snart som mulig.
          </p>
          <a href="/" className="btn text-xs inline-block">Til forsiden</a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-lg mx-auto px-4 space-y-4">
        <div>
          <a href="/" className="text-xs text-gray-600 underline">← Tilbake</a>
          <h1 className="mt-2 text-xl font-semibold text-gray-900">Søk om tilgang som klubb</h1>
          <p className="text-sm text-gray-600 mt-1">
            Klubber som ikke allerede er registrert kan søke om å bli med i fordelingen av aktivitetssaler.
            Søknaden behandles av Oslo idrettssekretariat.
          </p>
        </div>

        <form onSubmit={submit} className="card p-5 space-y-3">
          <div>
            <label className="label">Klubbnavn *</label>
            <input required className="input" value={form.navn} onChange={e => setForm({ ...form, navn: e.target.value })} />
          </div>
          <div>
            <label className="label">Idrett *</label>
            <select
              required
              className="input"
              value={idrettValg}
              onChange={e => setIdrettValg(e.target.value)}
            >
              <option value="">— Velg idrett —</option>
              {IDRETT_VALG.map(i => <option key={i} value={i}>{i}</option>)}
              <option value="Annet">Annet (skriv inn)</option>
            </select>
            {idrettValg === 'Annet' && (
              <input
                required
                placeholder="Skriv inn idrett"
                className="input mt-2"
                value={idrettAnnet}
                onChange={e => setIdrettAnnet(e.target.value)}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">E-post *</label>
              <input required type="email" className="input" value={form.epost} onChange={e => setForm({ ...form, epost: e.target.value })} />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input className="input" value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kontaktperson</label>
              <input className="input" value={form.kontaktperson} onChange={e => setForm({ ...form, kontaktperson: e.target.value })} />
            </div>
            <div>
              <label className="label">Org.nummer</label>
              <input placeholder="9 siffer" className="input" value={form.organisasjonsnummer} onChange={e => setForm({ ...form, organisasjonsnummer: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Kort om klubben (valgfritt)</label>
            <textarea rows={4} className="input" value={form.beskrivelse} onChange={e => setForm({ ...form, beskrivelse: e.target.value })}
              placeholder="Antall medlemmer, treningsbehov, hvilke saler dere er interessert i..." />
          </div>
          {error && <p className="text-xs text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={sending} className="btn-primary w-full">
            {sending ? 'Sender…' : 'Send søknad'}
          </button>
          <p className="text-[10px] text-gray-500 text-center">
            Vi behandler kontaktopplysningene dine for å kunne svare på søknaden. Se Oslo kommunes personvernerklæring.
          </p>
        </form>
      </div>
    </main>
  )
}
