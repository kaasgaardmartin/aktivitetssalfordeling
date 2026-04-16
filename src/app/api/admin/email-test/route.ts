import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { sendEmail, emailLayout, emailConfigCheck } from '@/lib/email'
import { z } from 'zod'

const testSchema = z.object({
  to: z.string().email('Ugyldig e-postadresse'),
})

// GET /api/admin/email-test — rapporter konfigurasjonsstatus
export async function GET() {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  return NextResponse.json({
    from: process.env.EMAIL_FROM ?? null,
    reply_to: process.env.EMAIL_REPLY_TO ?? null,
    app_url: process.env.NEXT_PUBLIC_APP_URL ?? null,
    api_key_present: !!process.env.RESEND_API_KEY,
    api_key_looks_valid: process.env.RESEND_API_KEY?.startsWith('re_') ?? false,
    warnings: emailConfigCheck(),
  })
}

// POST /api/admin/email-test — send en testmail til valgt adresse
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  const body = await request.json().catch(() => ({}))
  const parsed = testSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const warnings = emailConfigCheck()

  const result = await sendEmail({
    to: parsed.data.to,
    subject: 'Testmail — Aktivitetssaler Oslo',
    html: emailLayout({
      title: 'E-postoppsettet ser ut til å fungere',
      body: `
        <p>Hei!</p>
        <p>Dette er en testmail sendt fra admin-panelet i <strong>Aktivitetssaler Oslo</strong>.</p>
        <p>Hvis du ser denne meldingen, betyr det at Resend-oppsettet er riktig konfigurert og at systemet er klart til å sende varsler til klubber.</p>
        <p style="font-size:12px;color:#666">Sendt ${new Date().toLocaleString('nb-NO')} av ${auth.admin.epost ?? 'ukjent admin'}.</p>
      `,
    }),
  })

  return NextResponse.json({
    ok: result.ok,
    dev: result.dev ?? false,
    id: result.id ?? null,
    error: result.error ?? null,
    warnings,
  })
}
