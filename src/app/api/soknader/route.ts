import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { sendEmail, emailLayout, formatUkedag, formatTimeShort } from '@/lib/email'

async function getSession() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('klubb_session')?.value
  if (!raw) return null
  try {
    const s = JSON.parse(raw)
    if (new Date(s.exp) < new Date()) return null
    return s as { klubb_id: string; sesong_id: string }
  } catch { return null }
}

const soknadSchema = z.union([
  z.object({
    tidslot_id: z.string().uuid(),
    gruppe: z.enum(['barn', 'voksne', 'begge']),
    begrunnelse: z.string().min(10).max(500),
  }),
  z.object({
    hal_id: z.string().uuid(),
    ukedag: z.enum(['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lordag', 'sondag']),
    fra_kl: z.string().regex(/^\d{2}:\d{2}$/),
    til_kl: z.string().regex(/^\d{2}:\d{2}$/),
    gruppe: z.enum(['barn', 'voksne', 'begge']),
    begrunnelse: z.string().min(10).max(500),
  }),
])

// POST /api/soknader — submit new application
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const body = await request.json()
  const parsed = soknadSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createAdminClient()

  let slotId: string

  if ('tidslot_id' in parsed.data) {
    slotId = parsed.data.tidslot_id
  } else {
    // Find or create slot
    const { hal_id, ukedag, fra_kl, til_kl } = parsed.data
    const { data: existing } = await supabase
      .from('tidslots')
      .select('id, klubb_id, status')
      .eq('hal_id', hal_id)
      .eq('sesong_id', session.sesong_id)
      .eq('ukedag', ukedag)
      .eq('fra_kl', fra_kl + ':00')
      .single()

    if (existing) {
      if (existing.status === 'utilgjengelig') return NextResponse.json({ error: 'Tiden er markert som utilgjengelig' }, { status: 409 })
      if (existing.klubb_id) return NextResponse.json({ error: 'Slot er ikke lenger ledig' }, { status: 409 })
      slotId = existing.id
    } else {
      // Create the slot
      const { data: created, error: createErr } = await supabase
        .from('tidslots')
        .insert({ hal_id, sesong_id: session.sesong_id, ukedag, fra_kl: fra_kl + ':00', til_kl: til_kl + ':00' })
        .select('id')
        .single()
      if (createErr || !created) return NextResponse.json({ error: createErr?.message ?? 'Kunne ikke opprette slot' }, { status: 500 })
      slotId = created.id
    }
  }

  // Verify slot is actually available
  const { data: slot } = await supabase
    .from('tidslots')
    .select('id, klubb_id, status')
    .eq('id', slotId)
    .single()

  if (!slot) return NextResponse.json({ error: 'Slot finnes ikke' }, { status: 404 })
  if (slot.status === 'utilgjengelig') return NextResponse.json({ error: 'Tiden er markert som utilgjengelig' }, { status: 409 })
  if (slot.klubb_id) return NextResponse.json({ error: 'Slot er ikke lenger ledig' }, { status: 409 })

  // Check no duplicate application
  const { data: existingSoknad } = await supabase
    .from('soknader')
    .select('id')
    .eq('klubb_id', session.klubb_id)
    .eq('tidslot_id', slotId)
    .eq('status', 'venter')
    .single()

  if (existingSoknad) return NextResponse.json({ error: 'Søknad allerede sendt' }, { status: 409 })

  const { error } = await supabase.from('soknader').insert({
    sesong_id: session.sesong_id,
    klubb_id: session.klubb_id,
    tidslot_id: slotId,
    gruppe: parsed.data.gruppe,
    begrunnelse: parsed.data.begrunnelse,
    status: 'venter',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// GET /api/soknader — admin: all applications with club info
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sesongId = searchParams.get('sesong_id')
  const halId = searchParams.get('hal_id')

  const supabase = createAdminClient()

  let query = supabase
    .from('soknader_med_info')
    .select('*')
    .eq('status', 'venter')
    .order('opprettet_at', { ascending: true })

  if (sesongId) query = query.eq('sesong_id', sesongId)
  if (halId) query = query.eq('hal_id', halId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/soknader — admin godkjenn/avslå
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error
  const adminInfo = auth.admin

  const body = await request.json()
  const { id, status } = body as { id: string; status: 'godkjent' | 'avslatt' }

  if (!id || !['godkjent', 'avslatt'].includes(status)) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Hent søknad + klubb + slot-info for varsling
  const { data: soknad } = await supabase
    .from('soknader')
    .select('id, klubb_id, tidslot_id, begrunnelse, klubber(id, navn, epost), tidslots(id, ukedag, fra_kl, til_kl, haller(id, navn))')
    .eq('id', id)
    .single()

  if (!soknad) return NextResponse.json({ error: 'Fant ikke søknad' }, { status: 404 })

  const klubb: any = (soknad as any).klubber
  const slot: any = (soknad as any).tidslots
  const hallNavn = slot?.haller?.navn ?? 'Ukjent hall'

  // Avviste søknader som ble auto-avslått (returneres for varsling)
  let autoAvslattKlubber: { navn: string; epost: string }[] = []

  if (status === 'godkjent') {
    // Tildel slot
    await supabase
      .from('tidslots')
      .update({ klubb_id: soknad.klubb_id })
      .eq('id', soknad.tidslot_id)

    // Hent andre ventende søkere (for varsling)
    const { data: andreSoknader } = await supabase
      .from('soknader')
      .select('id, klubber(navn, epost)')
      .eq('tidslot_id', soknad.tidslot_id)
      .eq('status', 'venter')
      .neq('id', id)
    autoAvslattKlubber = (andreSoknader ?? [])
      .map((s: any) => s.klubber)
      .filter((k: any) => k && k.epost)

    // Auto-avslå andre
    await supabase
      .from('soknader')
      .update({ status: 'avslatt', behandlet_at: new Date().toISOString() })
      .eq('tidslot_id', soknad.tidslot_id)
      .neq('id', id)
  }

  const { error } = await supabase
    .from('soknader')
    .update({ status, behandlet_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit
  await logAudit({
    admin_id: adminInfo.id,
    admin_epost: adminInfo.epost,
    handling: status === 'godkjent' ? 'soknad_godkjent' : 'soknad_avslatt',
    entitet: 'soknader',
    entitet_id: id,
    beskrivelse: `${status === 'godkjent' ? 'Godkjente' : 'Avslo'} søknad fra ${klubb?.navn ?? 'ukjent klubb'} på ${hallNavn} ${slot ? `${formatUkedag(slot.ukedag)} ${formatTimeShort(slot.fra_kl)}–${formatTimeShort(slot.til_kl)}` : ''}`,
    metadata: { hall: hallNavn, klubb: klubb?.navn, slot: slot ? { ukedag: slot.ukedag, fra: slot.fra_kl, til: slot.til_kl } : null },
  })

  // E-post til søkerklubb
  if (klubb?.epost && slot) {
    const tidTekst = `${formatUkedag(slot.ukedag)} ${formatTimeShort(slot.fra_kl)}–${formatTimeShort(slot.til_kl)}`
    if (status === 'godkjent') {
      await sendEmail({
        to: klubb.epost,
        subject: `Søknad godkjent — ${hallNavn}`,
        html: emailLayout({
          title: 'Søknaden din ble godkjent',
          body: `
            <p>Hei ${klubb.navn},</p>
            <p>Administrator har <strong>godkjent</strong> søknaden din om tid på <strong>${hallNavn}</strong>:</p>
            <p style="background:#f3f4f6;padding:10px 14px;border-radius:8px"><strong>${tidTekst}</strong></p>
            <p>Treningstiden er nå tildelt klubben deres.</p>
          `,
        }),
      })
    } else {
      await sendEmail({
        to: klubb.epost,
        subject: `Søknad avslått — ${hallNavn}`,
        html: emailLayout({
          title: 'Søknaden din ble avslått',
          body: `
            <p>Hei ${klubb.navn},</p>
            <p>Administrator har dessverre <strong>avslått</strong> søknaden din om tid på <strong>${hallNavn}</strong> (${tidTekst}).</p>
            <p>Ta kontakt med idrettssekretariatet hvis du har spørsmål.</p>
          `,
        }),
      })
    }
  }

  // E-post til andre søkere som ble auto-avslått
  if (status === 'godkjent' && autoAvslattKlubber.length > 0 && slot) {
    const tidTekst = `${formatUkedag(slot.ukedag)} ${formatTimeShort(slot.fra_kl)}–${formatTimeShort(slot.til_kl)}`
    await Promise.all(autoAvslattKlubber.map(k => sendEmail({
      to: k.epost,
      subject: `Søknad avslått — ${hallNavn}`,
      html: emailLayout({
        title: 'Søknaden din ble avslått',
        body: `
          <p>Hei ${k.navn},</p>
          <p>Treningstiden du søkte på er dessverre tildelt en annen klubb:</p>
          <p style="background:#f3f4f6;padding:10px 14px;border-radius:8px"><strong>${hallNavn}</strong> — ${tidTekst}</p>
          <p>Du kan fortsatt søke på andre ledige tider i systemet.</p>
        `,
      }),
    })))
  }

  return NextResponse.json({ ok: true })
}
