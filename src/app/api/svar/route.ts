import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { z } from 'zod'

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

// PATCH /api/svar — admin handles a change request (godkjenn/avslå)
export async function PATCH(request: NextRequest) {
  const { createServerClientInstance } = await import('@/lib/supabase')
  const serverClient = await createServerClientInstance()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: adminRow } = await adminClient.from('admin_brukere').select('id').eq('auth_id', user.id).single()
  if (!adminRow) return NextResponse.json({ error: 'Ikke admin' }, { status: 403 })

  const body = await request.json()
  const { id, action } = body as { id: string; action: 'godkjenn' | 'avslaa' }
  if (!id || !['godkjenn', 'avslaa'].includes(action)) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (action === 'godkjenn') {
    // Fetch the change request
    const { data: svar, error: svarErr } = await supabase
      .from('svar')
      .select('*')
      .eq('id', id)
      .single()
    if (svarErr || !svar) return NextResponse.json({ error: 'Fant ikke svar' }, { status: 404 })

    // Update the time slot with the requested changes
    const updates: Record<string, string> = {}
    if (svar.ny_ukedag) updates.ukedag = svar.ny_ukedag
    if (svar.ny_fra_kl) updates.fra_kl = svar.ny_fra_kl
    if (svar.ny_til_kl) updates.til_kl = svar.ny_til_kl

    if (Object.keys(updates).length > 0) {
      const { error: slotErr } = await supabase
        .from('tidslots')
        .update(updates)
        .eq('id', svar.tidslot_id)
      if (slotErr) return NextResponse.json({ error: slotErr.message }, { status: 500 })
    }

    // Mark the svar as confirmed (change applied)
    await supabase.from('svar').update({ handling: 'bekreft' }).eq('id', id)
  } else {
    // Reject — just mark as confirmed (keep original slot unchanged)
    await supabase.from('svar').update({ handling: 'bekreft', ny_ukedag: null, ny_fra_kl: null, ny_til_kl: null, kommentar: null }).eq('id', id)
  }

  return NextResponse.json({ ok: true })
}
