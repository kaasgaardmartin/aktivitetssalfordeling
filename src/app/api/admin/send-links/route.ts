import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { sendEmail, emailLayout } from '@/lib/email'

// POST /api/admin/send-links — generate and send magic links to all clubs
export async function POST(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const body = await request.json()
  const { sesong_id } = body as { sesong_id: string }

  if (!sesong_id) return NextResponse.json({ error: 'Mangler sesong_id' }, { status: 400 })

  const supabase = createAdminClient()

  // Hent sesongen for å vise navnet i mailen
  const { data: sesong } = await supabase
    .from('sesonger')
    .select('navn, frist')
    .eq('id', sesong_id)
    .single()

  // Get all active clubs
  const { data: klubber, error: klubbErr } = await supabase
    .from('klubber')
    .select('id, navn, epost')
    .eq('aktiv', true)

  if (klubbErr) return NextResponse.json({ error: klubbErr.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const sesongNavn = sesong?.navn ?? 'kommende sesong'
  const fristFormatert = sesong?.frist
    ? new Date(sesong.frist).toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const results: { klubb: string; ok: boolean; error?: string; dev_url?: string }[] = []

  for (const klubb of klubber ?? []) {
    if (!klubb.epost) {
      results.push({ klubb: klubb.navn, ok: false, error: 'mangler e-post' })
      continue
    }
    // Create magic link token
    const { data: link, error: linkErr } = await supabase
      .from('magic_links')
      .insert({ klubb_id: klubb.id, sesong_id })
      .select('token')
      .single()

    if (linkErr || !link) {
      results.push({ klubb: klubb.navn, ok: false, error: linkErr?.message ?? 'kunne ikke opprette magic link' })
      continue
    }

    const url = `${appUrl}/api/magic-link?token=${link.token}`

    // I dev-modus (ingen RESEND_API_KEY) sender sendEmail() ingen mail men returnerer ok.
    // Vi vil likevel ha lenken tilbake, så vi eksponerer den her.
    if (!process.env.RESEND_API_KEY) {
      console.log(`[DEV] Magic link for ${klubb.navn}: ${url}`)
      results.push({ klubb: klubb.navn, ok: true, dev_url: url })
      continue
    }

    const result = await sendEmail({
      to: klubb.epost,
      subject: `${sesongNavn} — bekreft dine treningstider`,
      html: emailLayout({
        title: 'Bekreft treningstidene dine',
        body: `
          <p>Hei ${klubb.navn},</p>
          <p>Det er tid for å bekrefte treningstidene dine for <strong>${sesongNavn}</strong>${fristFormatert ? `. Fristen er <strong>${fristFormatert}</strong>` : ''}.</p>
          <p style="margin:20px 0"><a href="${url}" style="background:#1a1a1a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Gå til mine tider</a></p>
          <p style="font-size:12px;color:#666">Lenken er personlig og gyldig i 7 dager. Ikke del den med andre.</p>
          <p style="font-size:12px;color:#666">Hvis knappen ikke fungerer, kopier denne lenken i nettleseren:<br/><span style="word-break:break-all">${url}</span></p>
        `,
      }),
    })

    if (result.ok) {
      results.push({ klubb: klubb.navn, ok: true })
    } else {
      results.push({ klubb: klubb.navn, ok: false, error: result.error })
    }
  }

  const sent = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length
  return NextResponse.json({ sent, failed, results })
}
