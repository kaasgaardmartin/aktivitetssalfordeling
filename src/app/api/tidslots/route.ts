import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const slotSchema = z.object({
  hal_id: z.string().uuid(),
  sesong_id: z.string().uuid(),
  ukedag: z.enum(['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lordag', 'sondag']),
  fra_kl: z.string().regex(/^\d{2}:\d{2}$/, 'Ugyldig tidsformat'),
  til_kl: z.string().regex(/^\d{2}:\d{2}$/, 'Ugyldig tidsformat'),
  klubb_id: z.string().uuid().nullable().optional(),
})

// PATCH støtter to former:
//   { id, klubb_id }              — tildel/frigjør klubb (eksisterende)
//   { ids: [], status: '...' }    — sett status (utilgjengelig/ledig) på én eller flere slots
const slotUpdateSchema = z.union([
  z.object({
    id: z.string().uuid(),
    klubb_id: z.string().uuid().nullable(),
  }),
  z.object({
    ids: z.array(z.string().uuid()).min(1),
    status: z.enum(['ledig', 'utilgjengelig']),
  }),
])

// GET /api/tidslots?sesong_id=&hal_id=&klubb_id=
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sesongId = searchParams.get('sesong_id')
  const halId = searchParams.get('hal_id')
  const klubbId = searchParams.get('klubb_id')
  const ledig = searchParams.get('ledig')

  const supabase = createAdminClient()

  let query = supabase
    .from('tidslots')
    .select('*, haller(id, navn, underlag, merknader, stengedager), klubber(id, navn, idrett)')
    .order('ukedag')
    .order('fra_kl')

  if (sesongId) query = query.eq('sesong_id', sesongId)
  if (halId) query = query.eq('hal_id', halId)
  if (klubbId) query = query.eq('klubb_id', klubbId)
  if (ledig === 'true') query = query.is('klubb_id', null)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/tidslots — admin creates slot(s)
export async function POST(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const body = await request.json()
  const items = Array.isArray(body) ? body : [body]

  // Validate each slot
  const validated = []
  for (const item of items) {
    const parsed = slotSchema.safeParse(item)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    validated.push(parsed.data)
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tidslots')
    .insert(validated)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/tidslots — admin tildeler/frigjør, eller setter status
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  const body = await request.json()
  const parsed = slotUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createAdminClient()

  // Form 2: bulk status update
  if ('ids' in parsed.data) {
    const { ids, status } = parsed.data
    // Når man markerer som utilgjengelig, frigjør klubb samtidig
    const update: any = { status }
    if (status === 'utilgjengelig') update.klubb_id = null

    const { error } = await supabase
      .from('tidslots')
      .update(update)
      .in('id', ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logAudit({
      admin_id: auth.admin.id,
      admin_epost: auth.admin.epost,
      handling: status === 'utilgjengelig' ? 'slot_blokkert' : 'slot_frigjort',
      entitet: 'tidslots',
      entitet_id: ids[0],
      beskrivelse: status === 'utilgjengelig'
        ? `Markerte ${ids.length} tidslot${ids.length > 1 ? 's' : ''} som utilgjengelig`
        : `Frigjorde ${ids.length} tidslot${ids.length > 1 ? 's' : ''}`,
      metadata: { ids, status },
    })

    return NextResponse.json({ ok: true, count: ids.length })
  }

  // Form 1: enkelt-tildeling (bakoverkompatibel)
  const { data, error } = await supabase
    .from('tidslots')
    .update({ klubb_id: parsed.data.klubb_id })
    .eq('id', parsed.data.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/tidslots?id=
export async function DELETE(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const id = request.nextUrl.searchParams.get('id')
  if (!id || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Ugyldig eller manglende id' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('tidslots').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
