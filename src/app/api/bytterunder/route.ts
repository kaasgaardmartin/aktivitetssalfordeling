import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { z } from 'zod'

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

const bytteSchema = z.object({
  mottakende_klubb: z.string().uuid(),
  slot_a_id: z.string().uuid(), // initierende club gives up this slot
  slot_b_id: z.string().uuid(), // wants this slot from other club
  melding: z.string().max(300).optional(),
})

// POST /api/bytterunder — propose a swap
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const body = await request.json()
  const parsed = bytteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createAdminClient()

  // Verify both slots are in same hall
  const { data: slots } = await supabase
    .from('tidslots')
    .select('id, hal_id, klubb_id')
    .in('id', [parsed.data.slot_a_id, parsed.data.slot_b_id])

  if (!slots || slots.length !== 2) return NextResponse.json({ error: 'Slots finnes ikke' }, { status: 404 })
  if (slots[0].hal_id !== slots[1].hal_id) return NextResponse.json({ error: 'Slots må være i samme sal' }, { status: 400 })

  const { data, error } = await supabase
    .from('bytterunder')
    .insert({
      sesong_id: session.sesong_id,
      initierende_klubb: session.klubb_id,
      mottakende_klubb: parsed.data.mottakende_klubb,
      slot_a_id: parsed.data.slot_a_id,
      slot_b_id: parsed.data.slot_b_id,
      melding: parsed.data.melding ?? null,
      status: 'venter',
      initierende_svar: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/bytterunder — respond to swap proposal
export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { id, aksepter } = await request.json() as { id: string; aksepter: boolean }
  const supabase = createAdminClient()

  const { data: bytte } = await supabase
    .from('bytterunder')
    .select('*')
    .eq('id', id)
    .eq('mottakende_klubb', session.klubb_id)
    .eq('status', 'venter')
    .single()

  if (!bytte) return NextResponse.json({ error: 'Bytteforslag ikke funnet' }, { status: 404 })

  if (!aksepter) {
    await supabase.from('bytterunder').update({ status: 'avslatt', mottakende_svar: false }).eq('id', id)
    return NextResponse.json({ ok: true, status: 'avslatt' })
  }

  // Both accepted — execute the swap
  await supabase.from('tidslots').update({ klubb_id: bytte.mottakende_klubb }).eq('id', bytte.slot_a_id)
  await supabase.from('tidslots').update({ klubb_id: bytte.initierende_klubb }).eq('id', bytte.slot_b_id)
  await supabase.from('bytterunder').update({ status: 'godkjent', mottakende_svar: true }).eq('id', id)

  return NextResponse.json({ ok: true, status: 'godkjent' })
}

// GET /api/bytterunder — get pending swaps for current club
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('bytterunder')
    .select(`*, 
      slot_a:tidslots!slot_a_id(ukedag, fra_kl, til_kl, haller(navn)),
      slot_b:tidslots!slot_b_id(ukedag, fra_kl, til_kl, haller(navn)),
      init_klubb:klubber!initierende_klubb(navn),
      mot_klubb:klubber!mottakende_klubb(navn)`)
    .or(`initierende_klubb.eq.${session.klubb_id},mottakende_klubb.eq.${session.klubb_id}`)
    .eq('sesong_id', session.sesong_id)
    .order('opprettet_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
