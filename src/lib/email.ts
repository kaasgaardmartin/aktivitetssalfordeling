// Felles e-postsending via Resend.
// Logger til konsoll i dev hvis RESEND_API_KEY mangler.

export interface SendEmailArgs {
  to: string | string[]
  subject: string
  html: string
  replyTo?: string
}

export interface SendEmailResult {
  ok: boolean
  error?: string
  dev?: boolean
  id?: string
}

const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'noreply@example.com'
const DEFAULT_REPLY_TO = process.env.EMAIL_REPLY_TO ?? null
const RESEND_URL = 'https://api.resend.com/emails'

/**
 * Sjekk at e-post-konfigurasjonen ser fornuftig ut. Returnerer en liste
 * med advarsler (tom liste = alt OK). Brukes av admin-testendepunktet og
 * kan kalles ved oppstart for å feile tidlig.
 */
export function emailConfigCheck(): string[] {
  const warnings: string[] = []
  if (!process.env.RESEND_API_KEY) warnings.push('RESEND_API_KEY er ikke satt — e-poster vil kun logges til konsoll (dev-modus).')
  else if (!process.env.RESEND_API_KEY.startsWith('re_')) warnings.push('RESEND_API_KEY ser ikke ut som en gyldig Resend-nøkkel (skal starte med «re_»).')
  if (!process.env.EMAIL_FROM) warnings.push('EMAIL_FROM er ikke satt — bruker fallback «noreply@example.com» som Resend vil avvise.')
  else if (process.env.EMAIL_FROM.includes('example.com')) warnings.push('EMAIL_FROM peker fortsatt på example.com — bytt til verifisert avsenderadresse.')
  if (!process.env.EMAIL_REPLY_TO) warnings.push('EMAIL_REPLY_TO er ikke satt — svar fra klubber går til avsender-adressen (som ofte er en død «noreply»-innboks).')
  return warnings
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailArgs): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV EMAIL] to=${JSON.stringify(to)} subject=${subject}`)
    console.log(html.slice(0, 400))
    return { ok: true, dev: true }
  }

  const effectiveReplyTo = replyTo ?? DEFAULT_REPLY_TO

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: DEFAULT_FROM,
        to,
        subject,
        html,
        ...(effectiveReplyTo ? { reply_to: effectiveReplyTo } : {}),
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      const error = `Resend ${res.status}: ${detail.slice(0, 300)}`
      // Logg alltid til server-logg så feilen ikke forsvinner i ingenting
      console.error(`[EMAIL FEILET] to=${JSON.stringify(to)} subject=${subject} — ${error}`)
      return { ok: false, error }
    }
    const body = await res.json().catch(() => ({} as any))
    return { ok: true, id: body?.id }
  } catch (e: any) {
    const error = e?.message ?? String(e)
    console.error(`[EMAIL FEILET] to=${JSON.stringify(to)} subject=${subject} — ${error}`)
    return { ok: false, error }
  }
}

// Felles HTML-wrapper slik at alle e-poster ser like ut
export function emailLayout({ title, body }: { title: string; body: string }) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
      <div style="border-bottom:2px solid #1a1a1a;padding-bottom:16px;margin-bottom:24px">
        <p style="font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#666;margin:0">Oslo idrettssekretariat</p>
        <h1 style="font-size:22px;font-weight:700;margin:6px 0 0 0;color:#1a1a1a">${title}</h1>
      </div>
      <div style="font-size:14px;line-height:1.6;color:#1a1a1a">${body}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 14px 0" />
      <p style="font-size:11px;color:#999;margin:0;line-height:1.5">
        Oslo idrettssekretariat · Aktivitetssaler Oslo<br/>
        Denne meldingen ble sendt automatisk — svar til denne e-posten for å komme i kontakt.
      </p>
    </div>
  `
}

// Utility: fin-formater ukedag
export function formatUkedag(d: string) { return d ? d.charAt(0).toUpperCase() + d.slice(1) : '' }
export function formatTimeShort(t: string) { return (t ?? '').slice(0, 5) }
