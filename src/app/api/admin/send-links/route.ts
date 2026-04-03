import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// POST /api/admin/send-links — generate and send magic links to all clubs
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { sesong_id } = body as { sesong_id: string }

  if (!sesong_id) return NextResponse.json({ error: 'Mangler sesong_id' }, { status: 400 })

  const supabase = createAdminClient()

  // Get all active clubs
  const { data: klubber, error: klubbErr } = await supabase
    .from('klubber')
    .select('id, navn, epost')
    .eq('aktiv', true)

  if (klubbErr) return NextResponse.json({ error: klubbErr.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const results = []

  for (const klubb of klubber ?? []) {
    // Create magic link token
    const { data: link, error: linkErr } = await supabase
      .from('magic_links')
      .insert({ klubb_id: klubb.id, sesong_id })
      .select('token')
      .single()

    if (linkErr || !link) {
      results.push({ klubb: klubb.navn, ok: false, error: linkErr?.message })
      continue
    }

    const url = `${appUrl}/api/magic-link?token=${link.token}`

    // Send email via Resend (or log in dev)
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM ?? 'noreply@example.com',
            to: klubb.epost,
            subject: 'Treningstidsfordeling 2026/27 — bekreft dine tider',
            html: `
              <p>Hei ${klubb.navn},</p>
              <p>Det er tid for å bekrefte treningstidene dine for neste sesong.</p>
              <p><a href="${url}" style="background:#1a1a1a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0">Gå til mine tider</a></p>
              <p>Lenken er gyldig i 7 dager. Dersom du ikke gjør noe, ta kontakt med idrettssekretariatet.</p>
              <p style="color:#888;font-size:12px">Oslo idrettssekretariat — aktivitetssalfordeling</p>
            `,
          }),
        })
        results.push({ klubb: klubb.navn, ok: true })
      } catch (e) {
        results.push({ klubb: klubb.navn, ok: false, error: String(e) })
      }
    } else {
      // Dev mode: log the link
      console.log(`[DEV] Magic link for ${klubb.navn}: ${url}`)
      results.push({ klubb: klubb.navn, ok: true, dev_url: url })
    }

  }

  return NextResponse.json({ sent: results.filter(r => r.ok).length, results })
}
