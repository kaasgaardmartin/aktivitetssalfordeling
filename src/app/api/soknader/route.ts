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

const soknadSchema = z.object({
  tidslot_id: z.string().uuid(),
  gruppe: z.enum(['barn', 'voksne', 'begge']),
  begrunnelse: z.string().min(10).max(500),
})

// POST /api/soknader — submit new application
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const body = await request.json()
  const parsed = soknadSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createAdminClient()

  // Verify slot is actually available
  const { data: slot } = await supabase
    .from('tidslots')
    .select('id, klubb_id')
    .eq('id', parsed.data.tidslot_id)
    .single()

  if (!slot) return NextResponse.json({ error: 'Slot finnes ikke' }, { status: 404 })
  if (slot.klubb_id) return NextResponse.json({ error: 'Slot er ikke lenger ledig' }, { status: 409 })

  // Check no duplicate application
  const { data: existing } = await supabase
    .from('soknader')
    .select('id')
    .eq('klubb_id', session.klubb_id)
    .eq('tidslot_id', parsed.data.tidslot_id)
    .eq('status', 'venter')
    .single()

  if (existing) return NextResponse.json({ error: 'Søknad allerede sendt' }, { status: 409 })

  const { error } = await supabase.from('soknader').insert({
    sesong_id: session.sesong_id,
    klubb_id: session.klubb_id,
    tidslot_id: parsed.data.tidslot_id,
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

// PATCH /api/soknader/:id — admin approve/reject
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, status } = body as { id: string; status: 'godkjent' | 'avslatt' }

  if (!id || !['godkjent', 'avslatt'].includes(status)) {
    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // If approving, assign slot to club and auto-reject others
  if (status === 'godkjent') {
    const { data: soknad } = await supabase
      .from('soknader')
      .select('klubb_id, tidslot_id')
      .eq('id', id)
      .single()

    if (soknad) {
      // Assign slot
      await supabase
        .from('tidslots')
        .update({ klubb_id: soknad.klubb_id })
        .eq('id', soknad.tidslot_id)

      // Reject other applicants for same slot
      await supabase
        .from('soknader')
        .update({ status: 'avslatt', behandlet_at: new Date().toISOString() })
        .eq('tidslot_id', soknad.tidslot_id)
        .neq('id', id)
    }
  }

  const { error } = await supabase
    .from('soknader')
    .update({ status, behandlet_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
