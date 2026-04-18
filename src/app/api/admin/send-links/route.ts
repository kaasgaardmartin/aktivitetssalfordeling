import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { sendEmail, emailLayout } from '@/lib/email'

// POST /api/admin/send-links — generate and send magic links to all clubs
export async function POST(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const body = await request.json()
  const { sesong_id, klubb_ids } = body as { sesong_id: string; klubb_ids?: string[] }

  if (!sesong_id) return NextResponse.json({ error: 'Mangler sesong_id' }, { status: 400 })

  const supabase = createAdminClient()

  // Hent sesongen for å vise navnet i mailen
  const { data: sesongRaw } = await supabase
    .from('sesonger')
    .select('navn, frist')
    .eq('id', sesong_id)
    .single()
  const sesong = sesongRaw as { navn: string; frist: string | null } | null

  // Hent aktive klubber — enten utvalgte eller alle
  const baseQuery = supabase.from('klubber').select('id, navn, epost').eq('aktiv', true)
  const { data: klubberRaw, error: klubbErr } = await (
    klubb_ids && klubb_ids.length > 0 ? baseQuery.in('id', klubb_ids) : baseQuery
  )
  const klubber = (klubberRaw ?? []) as Array<{ id: string; navn: string; epost: string | null }>

  if (klubbErr) return NextResponse.json({ error: klubbErr.message }, { status: 500 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const sesongNavn = sesong?.navn ?? 'kommende sesong'
  const fristFormatert = sesong?.frist
    ? new Date(sesong.frist).toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const results: { klubb: string; ok: boolean; error?: string; dev_url?: string }[] = []

  for (const klubb of klubber) {
    if (!klubb.epost) {
      results.push({ klubb: klubb.navn, ok: false, error: 'mangler e-post' })
      continue
    }
    // Create magic link token
    const { data: linkRaw, error: linkErr } = await supabase
      .from('magic_links')
      .insert({ klubb_id: klubb.id, sesong_id } as any)
      .select('token')
      .single()
    const link = linkRaw as { token: string } | null

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
      subject: `${sesongNavn} — gjennomgå og bekreft treningstidene dine`,
      html: emailLayout({
        title: '',
        body: `
          <p>Hei ${klubb.navn},</p>

          <p>Forslag til treningstider for <strong>${sesongNavn}</strong> er nå klare. Vi ber dere gå gjennom de foreslåtte tidene og bekrefte, melde endringer eller si opp tider dere ikke lenger har behov for.</p>

          ${fristFormatert ? `
          <div style="border-left:4px solid #d97706;padding:12px 16px;margin:20px 0">
            <p style="margin:0;font-weight:600;color:#92400e">Frist: ${fristFormatert}</p>
            <p style="margin:4px 0 0 0;font-size:13px;color:#92400e">Tider som ikke bekreftes innen fristen regnes som godkjent uendret.</p>
          </div>` : ''}

          <p style="font-weight:600;margin-bottom:6px">Dette gjør dere i portalen:</p>
          <ol style="padding-left:20px;margin:0 0 20px 0;line-height:1.8">
            <li>Gå gjennom de tildelte tidene — bekreft, foreslå endringer eller si opp tider dere ikke trenger</li>
            <li>Søk om ekstra tid hvis dere har behov utover det som er tildelt</li>
            <li>Klikk «Bekreft og lagre» når dere er ferdige</li>
          </ol>

          <p style="margin:24px 0">
            <a href="${url}" style="background:#1a1a1a;color:#fff;padding:13px 26px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;font-size:15px">Gå til mine treningstider</a>
          </p>

          <p style="font-size:12px;color:#666;margin-bottom:4px">Denne lenken er gyldig i 7 dager og gjelder kun for ${klubb.navn}.</p>
          <p style="font-size:12px;color:#666">Hvis knappen ikke fungerer, kopier denne lenken inn i nettleseren:<br/>
          <span style="word-break:break-all;color:#444">${url}</span></p>

          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
          <p style="font-size:13px;color:#444">Vi prøver i år et nytt digitalt system for fordeling av treningstider, og håper det gjør prosessen enklere for dere. Ta gjerne kontakt hvis noe er uklart eller ikke fungerer som det skal — vi er tilgjengelige på <a href="mailto:martin@kaasgaard.no" style="color:#1a1a1a">martin@kaasgaard.no</a>.</p>

          <p style="margin-top:20px;font-size:13px;color:#444">
            Beste hilsen<br/><br/>
            <strong>Kampidrettene</strong><br/>
            Norges Bokseforbund · Norges Bryteforbund · Norges Judoforbund<br/>
            Norges Kampsportforbund · Norges Kickboksingforbund · Norges Fekteforbund
          </p>
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
