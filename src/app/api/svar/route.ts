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

// POST /api/svar/bekreft-alle — confirm all slots unchanged
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

  const upserts = (slots ?? []).map(s => ({
    sesong_id: session.sesong_id,
    klubb_id: session.klubb_id,
    tidslot_id: s.id,
    handling: 'bekreft' as const,
  }))

  if (upserts.length > 0) {
    const { error } = await supabase
      .from('svar')
      .upsert(upserts, { onConflict: 'sesong_id,klubb_id,tidslot_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, bekreftet: upserts.length })
}
