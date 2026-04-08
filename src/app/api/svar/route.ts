import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { sendEmail, emailLayout, formatUkedag, formatTimeShort } from '@/lib/email'

const svarSchema = z.object({
  tidslot_id: z.string().uuid(),
  handling: z.enum(['bekreft', 'endre', 'si_opp']),
  ny_ukedag: z.string().optional(),
  ny_fra_kl: z.string().optional(),
  ny_til_kl: z.string().optional(),
  kommentar: z.string().optional(),
})

async function getSession() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('klubb_session')?.value
  if (!raw) return null
  try {
    const session = JSON.parse(raw)
    if (new Date(session.exp) < new Date()) return null
    return session as { klubb_id: string; sesong_id: string }
  } catch { return null }
}

// POST /api/svar — submit a single slot response
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const body = await request.json()
  const parsed = svarSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createAdminClient()

  // Upsert — one response per slot per session per club
  const { error } = await supabase
    .from('svar')
    .upsert({
      sesong_id: session.sesong_id,
      klubb_id: session.klubb_id,
      tidslot_id: parsed.data.tidslot_id,
      handling: parsed.data.handling,
      ny_ukedag: parsed.data.ny_ukedag ?? null,
      ny_fra_kl: parsed.data.ny_fra_kl ?? null,
      ny_til_kl: parsed.data.ny_til_kl ?? null,
      kommentar: parsed.data.kommentar ?? null,
    }, { onConflict: 'sesong_id,klubb_id,tidslot_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PUT /api/svar — confirm all REMAINING slots as unchanged
// (does not overwrite slots that already have an existing svar, e.g. endre/si_opp)
export async function PUT(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const supabase = createAdminClient()

  // Get all slots for this club in this season
  const { data: slots, error: slotsErr } = await supabase
    .from('tidslots')
    .select('id')
    .eq('klubb_id', session.klubb_id)
    .eq('sesong_id', session.sesong_id)

  if (slotsErr) return NextResponse.json({ error: slotsErr.message }, { status: 500 })

  // Get existing svar for this club in this season — disse skal ikke overstyres
  const { data: existing, error: existErr } = await supabase
    .from('svar')
    .select('tidslot_id')
    .eq('klubb_id', session.klubb_id)
    .eq('sesong_id', session.sesong_id)

  if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 })

  const existingIds = new Set((existing ?? []).map(r => r.tidslot_id))

  // Bare bekreft slots som mangler svar
  const inserts = (slots ?? [])
    .filter(s => !existingIds.has(s.id))
    .map(s => ({
      sesong_id: session.sesong_id,
      klubb_id: session.klubb_id,
      tidslot_id: s.id,
      handling: 'bekreft' as const,
    }))

  if (inserts.length > 0) {
    const { error } = await supabase.from('svar').insert(inserts)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, bekreftet: inserts.length })
}

// Hjelp: lag 30-min slots fra fra_kl..til_kl
function generate30minSlots(fra: string, til: string): { fra_kl: string; til_kl: string }[] {
  const out: { fra_kl: string; til_kl: string }[] = []
  const [fH, fM] = fra.slice(0, 5).split(':').map(Number)
  const [tH, tM] = til.slice(0, 5).split(':').map(Number)
  let cur = fH * 60 + fM
  const end = tH * 60 + tM
  while (cur + 30 <= end) {
    const h1 = String(Math.floor(cur / 60)).padStart(2, '0')
    const m1 = String(cur % 60).padStart(2, '0')
    const h2 = String(Math.floor((cur + 30) / 60)).padStart(2, '0')
    const m2 = String((cur + 30) % 60).padStart(2, '0')
    out.push({ fra_kl: `${h1}:${m1}:00`, til_kl: `${h2}:${m2}:00` })
    cur += 30
  }
  return out
}

// PATCH /api/svar — admin behandler endringsforespørsler (godkjenn/avslå)
// Aksepterer { ids: string[], action } for å håndtere hele blokker.
// Beholder { id, action } for bakoverkompatibilitet.
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error
  const adminInfo = auth.admin

  const body = await request.json()
  const { id, ids: idsRaw, action } = body as { id?: string; ids?: string[]; action: 'godkjenn' | 'avslaa' }
  const ids = idsRaw && idsRaw.length > 0 ? idsRaw : id ? [id] : []
  if (ids.length === 0 || !['godkjenn', 'avslaa'].includes(action)) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Hent alle svar-radene
  const { data: svarRader, error: svarErr } = await supabase
    .from('svar')
    .select('*')
    .in('id', ids)
  if (svarErr || !svarRader || svarRader.length === 0) {
    return NextResponse.json({ error: 'Fant ikke svar' }, { status: 404 })
  }

  // Hent første tidslot for visning i e-post/audit
  const tidslotIdsForInfo = svarRader.map(s => s.tidslot_id)
  const { data: infoSlots } = await supabase
    .from('tidslots')
    .select('*, haller(id, navn)')
    .in('id', tidslotIdsForInfo)
  const firstSlot: any = infoSlots && infoSlots.length > 0 ? infoSlots[0] : null
  const hallNavn: string = firstSlot?.haller?.navn ?? 'Ukjent hall'

  // Hent klubb for e-post
  const klubbIdForInfo = svarRader[0].klubb_id
  const { data: klubb } = await supabase
    .from('klubber')
    .select('id, navn, epost')
    .eq('id', klubbIdForInfo)
    .single()

  if (action === 'avslaa') {
    // Marker alle som bekreft og fjern endringsforslagene
    const { error } = await supabase
      .from('svar')
      .update({ handling: 'bekreft', ny_ukedag: null, ny_fra_kl: null, ny_til_kl: null, kommentar: null })
      .in('id', ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Audit
    await logAudit({
      admin_id: adminInfo.id,
      admin_epost: adminInfo.epost,
      handling: 'endring_avslatt',
      entitet: 'svar',
      entitet_id: ids[0],
      beskrivelse: `Avslo endringsforespørsel fra ${klubb?.navn ?? 'ukjent klubb'} for ${hallNavn}`,
      metadata: { antall_slots: ids.length, hall: hallNavn, klubb: klubb?.navn },
    })

    // E-post til klubb
    if (klubb?.epost && firstSlot) {
      const ukedag = firstSlot.ukedag
      const fra = formatTimeShort(firstSlot.fra_kl)
      const tilSlot = infoSlots?.reduce((last: any, s: any) => (s.til_kl > last.til_kl ? s : last), firstSlot)
      const til = formatTimeShort(tilSlot?.til_kl ?? firstSlot.til_kl)
      await sendEmail({
        to: klubb.epost,
        subject: `Endringsforespørsel avslått — ${hallNavn}`,
        html: emailLayout({
          title: 'Endringsforespørselen din ble avslått',
          body: `
            <p>Hei ${klubb.navn},</p>
            <p>Administrator har dessverre <strong>avslått</strong> endringsforespørselen din på <strong>${hallNavn}</strong> (${formatUkedag(ukedag)} ${fra}–${til}). Tidene dine beholdes uendret.</p>
            <p>Har du spørsmål, ta kontakt med idrettssekretariatet.</p>
          `,
        }),
      })
    }
    return NextResponse.json({ ok: true })
  }

  // GODKJENN: hele blokken skal erstattes
  // 1) Hent tidslot-data
  const tidslotIds = svarRader.map(s => s.tidslot_id)
  const { data: tidslots, error: tslErr } = await supabase
    .from('tidslots')
    .select('*')
    .in('id', tidslotIds)
  if (tslErr || !tidslots || tidslots.length === 0) {
    return NextResponse.json({ error: 'Fant ikke tidslots' }, { status: 404 })
  }

  // 2) Verifiser at alle hører til samme klubb, sesong og hall
  const klubb_id = svarRader[0].klubb_id
  const sesong_id = svarRader[0].sesong_id
  const hal_id = tidslots[0].hal_id
  const allSameKlubb = svarRader.every(s => s.klubb_id === klubb_id && s.sesong_id === sesong_id)
  const allSameHall = tidslots.every(t => t.hal_id === hal_id)
  if (!allSameKlubb || !allSameHall) {
    return NextResponse.json({ error: 'Endringene må gjelde samme klubb og hall' }, { status: 400 })
  }

  // 3) Hent ønsket ukedag/fra/til (bruk verdiene fra første svar — alle skal være like)
  const ny_ukedag = svarRader[0].ny_ukedag ?? tidslots[0].ukedag
  const ny_fra_kl = svarRader[0].ny_fra_kl ?? tidslots[0].fra_kl
  const ny_til_kl = svarRader[0].ny_til_kl ?? tidslots[0].til_kl

  // Gammel tid for logging/e-post
  const gammelUkedag = tidslots[0].ukedag
  const gammelFra = tidslots.reduce((min: any, t: any) => (t.fra_kl < min.fra_kl ? t : min), tidslots[0]).fra_kl
  const gammelTil = tidslots.reduce((max: any, t: any) => (t.til_kl > max.til_kl ? t : max), tidslots[0]).til_kl

  // 4) Slett gamle tidslots (cascade sletter svar-radene)
  const { error: delErr } = await supabase.from('tidslots').delete().in('id', tidslotIds)
  if (delErr) return NextResponse.json({ error: `Kunne ikke slette gamle slots: ${delErr.message}` }, { status: 500 })

  // 5) Generer nye 30-min slots for ønsket periode og insert
  const nyeSlots = generate30minSlots(ny_fra_kl, ny_til_kl).map(s => ({
    hal_id,
    sesong_id,
    klubb_id,
    ukedag: ny_ukedag,
    fra_kl: s.fra_kl,
    til_kl: s.til_kl,
  }))

  if (nyeSlots.length > 0) {
    const { error: insErr } = await supabase.from('tidslots').insert(nyeSlots)
    if (insErr) return NextResponse.json({ error: `Kunne ikke opprette nye slots: ${insErr.message}` }, { status: 500 })
  }

  // Audit
  await logAudit({
    admin_id: adminInfo.id,
    admin_epost: adminInfo.epost,
    handling: 'endring_godkjent',
    entitet: 'svar',
    entitet_id: ids[0],
    beskrivelse: `Godkjente endring for ${klubb?.navn ?? 'ukjent klubb'} på ${hallNavn}: ${formatUkedag(gammelUkedag)} ${formatTimeShort(gammelFra)}–${formatTimeShort(gammelTil)} → ${formatUkedag(ny_ukedag)} ${formatTimeShort(ny_fra_kl)}–${formatTimeShort(ny_til_kl)}`,
    metadata: {
      hall: hallNavn,
      klubb: klubb?.navn,
      gammel: { ukedag: gammelUkedag, fra: gammelFra, til: gammelTil },
      ny: { ukedag: ny_ukedag, fra: ny_fra_kl, til: ny_til_kl },
      antall_nye_slots: nyeSlots.length,
    },
  })

  // E-post til klubb
  if (klubb?.epost) {
    await sendEmail({
      to: klubb.epost,
      subject: `Endringsforespørsel godkjent — ${hallNavn}`,
      html: emailLayout({
        title: 'Endringsforespørselen din ble godkjent',
        body: `
          <p>Hei ${klubb.navn},</p>
          <p>Administrator har <strong>godkjent</strong> endringen din på <strong>${hallNavn}</strong>:</p>
          <p style="background:#f3f4f6;padding:10px 14px;border-radius:8px">
            <span style="color:#888;text-decoration:line-through">${formatUkedag(gammelUkedag)} ${formatTimeShort(gammelFra)}–${formatTimeShort(gammelTil)}</span><br/>
            <strong>${formatUkedag(ny_ukedag)} ${formatTimeShort(ny_fra_kl)}–${formatTimeShort(ny_til_kl)}</strong>
          </p>
          <p>De nye tidene er nå aktive.</p>
        `,
      }),
    })
  }

  return NextResponse.json({ ok: true, opprettet: nyeSlots.length })
}
