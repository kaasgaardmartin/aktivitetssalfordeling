'use client'

import { useEffect, useState } from 'react'

interface Config {
  from: string | null
  reply_to: string | null
  app_url: string | null
  api_key_present: boolean
  api_key_looks_valid: boolean
  warnings: string[]
}

interface SendResult {
  ok: boolean
  dev: boolean
  id: string | null
  error: string | null
  warnings: string[]
}

export default function EmailTestModal({ onClose, defaultTo }: { onClose: () => void; defaultTo?: string | null }) {
  const [config, setConfig] = useState<Config | null>(null)
  const [to, setTo] = useState(defaultTo ?? '')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)

  useEffect(() => {
    fetch('/api/admin/email-test')
      .then(r => r.json())
      .then(setConfig)
      .catch(() => setConfig(null))
  }, [])

  async function send() {
    if (!to) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      })
      const data = await res.json()
      setResult(data)
    } catch (e: any) {
      setResult({ ok: false, dev: false, id: null, error: e.message, warnings: [] })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-900">Test e-postoppsett</p>
          <button onClick={onClose} className="text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Konfigurasjonsstatus */}
        {config && (
          <div className="rounded-lg bg-gray-50 ring-1 ring-gray-200 px-3 py-2.5 space-y-1 text-[11px]">
            <div className="grid grid-cols-[80px_1fr] gap-1">
              <span className="text-gray-500">Avsender:</span>
              <span className={`font-mono ${config.from?.includes('example.com') || !config.from ? 'text-red-700' : 'text-gray-900'}`}>
                {config.from ?? '(ikke satt)'}
              </span>
              <span className="text-gray-500">Reply-to:</span>
              <span className="font-mono text-gray-900">{config.reply_to ?? '(ikke satt)'}</span>
              <span className="text-gray-500">App-URL:</span>
              <span className="font-mono text-gray-900 break-all">{config.app_url ?? '(ikke satt)'}</span>
              <span className="text-gray-500">API-nøkkel:</span>
              <span className={config.api_key_present && config.api_key_looks_valid ? 'text-green-700' : 'text-red-700'}>
                {config.api_key_present
                  ? config.api_key_looks_valid ? '✓ satt og ser gyldig ut' : '⚠ satt, men ser ikke ut som re_…'
                  : '✗ ikke satt (dev-modus)'}
              </span>
            </div>
            {config.warnings.length > 0 && (
              <div className="pt-1.5 mt-1.5 border-t border-gray-200 space-y-0.5">
                {config.warnings.map((w, i) => (
                  <p key={i} className="text-amber-800">⚠ {w}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="label">Send testmail til</label>
          <input
            type="email"
            placeholder="din.epost@example.com"
            className="input"
            value={to}
            onChange={e => setTo(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send() }}
          />
          <p className="text-[10px] text-gray-500 mt-1">
            Systemet sender en test-mail til adressen. Ingen klubber får noe.
          </p>
        </div>

        {result && (
          <div className={`rounded-lg px-3 py-2 text-xs ${result.ok ? 'bg-green-50 ring-1 ring-green-200 text-green-900' : 'bg-red-50 ring-1 ring-red-200 text-red-900'}`}>
            {result.ok ? (
              result.dev
                ? <>✓ Dev-modus: mailen ble logget til konsollen (ingen RESEND_API_KEY).</>
                : <>✓ Sendt! {result.id && <>Resend-id: <span className="font-mono">{result.id}</span></>}</>
            ) : (
              <>✗ Feilet: {result.error ?? 'ukjent feil'}</>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn text-xs">Lukk</button>
          <button onClick={send} disabled={!to || sending} className="btn-primary text-xs">
            {sending ? 'Sender…' : 'Send testmail'}
          </button>
        </div>
      </div>
    </div>
  )
}
