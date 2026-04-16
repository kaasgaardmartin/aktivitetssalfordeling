import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { sendEmail, emailLayout } from '@/lib/email'
import { z } from 'zod'

const registrerSchema = z.object({
  navn: z.string().min(2, 'Klubbnavn er for kort').max(120),
  idrett: z.string().min(2).max(80),
  epost: z.string().email('Ugyldig e-post'),
  kontaktperson: z.string().max(120).optional().or(z.literal('')),
  telefon: z.string().max(40).optional().or(z.literal('')),
  organisasjonsnummer: z.string().max(20).optional().or(z.literal('')),
  beskrivelse: z.string().max(1000).optional().or(z.literal('')),
})

const behandleSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['godkjent', 'avvist']),
  notat: z.string().max(500).optional(),
})

// POST /api/klubb/registrer — selvregistrering, åpent endepunkt
export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = registrerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createAdminClient()

  // Sjekk om klubb med samme e-post allerede har en åpen registrering
  const { data: existing } = await supabase
    .from('klubb_registreringer')
    .select('id, status')
    .eq('epost', parsed.data.epost)
    .eq('status', 'ny')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Det finnes allerede en åpen søknad for denne e-postadressen.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('klubb_registreringer')
    .insert({
      navn: parsed.data.navn.trim(),
      idrett: parsed.data.idrett.trim(),
      epost: parsed.data.epost.trim().toLowerCase(),
      kontaktperson: parsed.data.kontaktperson?.trim() || null,
      telefon: parsed.data.telefon?.trim() || null,
      organisasjonsnummer: parsed.data.organisasjonsnummer?.trim() || null,
      beskrivelse: parsed.data.beskrivelse?.trim() || null,
    } as any)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bekreftelses-epost til søker
  await sendEmail({
    to: parsed.data.epost,
    subject: 'Søknad om tilgang mottatt — Aktivitetssaler Oslo',
    html: emailLayout({
      title: 'Vi har mottatt søknaden din',
      body: `
        <p>Hei ${parsed.data.kontaktperson || parsed.data.navn},</p>
        <p>Vi har mottatt søknaden om at <strong>${parsed.data.navn}</strong> skal få tilgang til fordelingen av aktivitetssaler i Oslo.</p>
        <p>Idrettssekretariatet vil gjennomgå søknaden og kontakte deg så snart som mulig.</p>
      `,
    }),
  })
  // sendEmail logger feil selv, men søknaden skal lagres selv om mailen feiler

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}

// GET /api/klubb/registrer — admin: list registreringer
export async function GET() {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('klubb_registreringer')
    .select('*')
    .order('opprettet_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/klubb/registrer — admin behandler søknad
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  const body = await request.json()
  const parsed = behandleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createAdminClient()

  const { data: reg } = await supabase
    .from('klubb_registreringer')
    .select('*')
    .eq('id', parsed.data.id)
    .single()

  if (!reg) return NextResponse.json({ error: 'Søknad ikke funnet' }, { status: 404 })

  let nyKlubbId: string | null = null
  if (parsed.data.status === 'godkjent') {
    const { data: created, error: clubErr } = await supabase
      .from('klubber')
      .insert({
        navn: reg.navn,
        idrett: reg.idrett,
        epost: reg.epost,
        nif_org_id: reg.organisasjonsnummer,
        medlemstall: null,
        andel_barn: null,
        ant_0_5: 0, ant_6_12: 0, ant_13_19: 0, ant_20_25: 0, ant_26_pluss: 0,
        aktiv: true,
      } as any)
      .select('id')
      .single()
    if (clubErr) return NextResponse.json({ error: `Kunne ikke opprette klubb: ${clubErr.message}` }, { status: 500 })
    nyKlubbId = created.id
  }

  const { error: updErr } = await supabase
    .from('klubb_registreringer')
    .update({
      status: parsed.data.status,
      notat_admin: parsed.data.notat ?? null,
      behandlet_at: new Date().toISOString(),
      behandlet_av: auth.admin.id,
    })
    .eq('id', parsed.data.id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // E-post til søker
  await sendEmail({
    to: reg.epost,
    subject: parsed.data.status === 'godkjent'
      ? 'Søknad godkjent — Aktivitetssaler Oslo'
      : 'Søknad avvist — Aktivitetssaler Oslo',
    html: emailLayout({
      title: parsed.data.status === 'godkjent' ? 'Søknaden din er godkjent' : 'Søknaden din er avvist',
      body: parsed.data.status === 'godkjent'
        ? `<p>Hei ${reg.navn},</p>
           <p>Søknaden din er <strong>godkjent</strong>. Du vil motta en innloggingslenke når neste søknadsrunde åpnes.</p>
           ${parsed.data.notat ? `<p style="background:#f3f4f6;padding:10px 14px;border-radius:8px"><em>${parsed.data.notat}</em></p>` : ''}`
        : `<p>Hei ${reg.navn},</p>
           <p>Søknaden din er dessverre <strong>avvist</strong>.</p>
           ${parsed.data.notat ? `<p style="background:#fef2f2;padding:10px 14px;border-radius:8px"><em>${parsed.data.notat}</em></p>` : ''}
           <p>Ta kontakt med idrettssekretariatet hvis du har spørsmål.</p>`,
    }),
  })
  // sendEmail logger feil selv, men søknaden skal lagres selv om mailen feiler

  return NextResponse.json({ ok: true, klubb_id: nyKlubbId })
}
