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
}

const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'noreply@example.com'
const RESEND_URL = 'https://api.resend.com/emails'

export async function sendEmail({ to, subject, html, replyTo }: SendEmailArgs): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV EMAIL] to=${JSON.stringify(to)} subject=${subject}`)
    console.log(html.slice(0, 400))
    return { ok: true, dev: true }
  }

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
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}

// Felles HTML-wrapper slik at alle e-poster ser like ut
export function emailLayout({ title, body }: { title: string; body: string }) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
      <div style="border-bottom:1px solid #e5e7eb;padding-bottom:16px;margin-bottom:20px">
        <p style="font-size:13px;color:#666;margin:0">Aktivitetssaler Oslo</p>
        <h1 style="font-size:20px;margin:6px 0 0 0">${title}</h1>
      </div>
      <div style="font-size:14px;line-height:1.55;color:#1a1a1a">${body}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px 0" />
      <p style="font-size:11px;color:#888;margin:0">Denne meldingen ble sendt fra Oslo idrettssekretariat — aktivitetssalfordeling.</p>
    </div>
  `
}

// Utility: fin-formater ukedag
export function formatUkedag(d: string) { return d ? d.charAt(0).toUpperCase() + d.slice(1) : '' }
export function formatTimeShort(t: string) { return (t ?? '').slice(0, 5) }
