import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const hallCreateSchema = z.object({
  navn: z.string().min(2, 'Navn må ha minst 2 tegn'),
  underlag: z.string().nullable().optional(),
  merknader: z.string().nullable().optional(),
  adresse: z.string().nullable().optional(),
  stengedager: z.string().nullable().optional(),
})

const hallUpdateSchema = z.object({
  id: z.string().uuid(),
  navn: z.string().min(2).optional(),
  underlag: z.string().nullable().optional(),
  merknader: z.string().nullable().optional(),
  adresse: z.string().nullable().optional(),
  stengedager: z.string().nullable().optional(),
})

// GET /api/haller — list all active halls (public read is OK)
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('haller')
    .select('*')
    .eq('aktiv', true)
    .order('navn')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/haller — create hall (admin only)
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  const body = await request.json()
  const parsed = hallCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('haller')
    .insert(parsed.data)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    admin_id: auth.admin.id,
    admin_epost: auth.admin.epost,
    handling: 'hall_opprettet',
    entitet: 'haller',
    entitet_id: data.id,
    beskrivelse: `Opprettet hall «${data.navn}»`,
    metadata: parsed.data,
  })

  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/haller — update hall (admin only)
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  const body = await request.json()
  const parsed = hallUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { id, ...update } = parsed.data
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('haller')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    admin_id: auth.admin.id,
    admin_epost: auth.admin.epost,
    handling: 'hall_oppdatert',
    entitet: 'haller',
    entitet_id: id,
    beskrivelse: `Oppdaterte hall «${data.navn}»`,
    metadata: update,
  })

  return NextResponse.json(data)
}

// DELETE /api/haller — soft-delete hall (admin only)
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin()
  if (auth.error) return auth.error

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Mangler id' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: hall } = await supabase.from('haller').select('navn').eq('id', id).single()
  await supabase.from('tidslots').delete().eq('hal_id', id)

  const { error } = await supabase
    .from('haller')
    .update({ aktiv: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    admin_id: auth.admin.id,
    admin_epost: auth.admin.epost,
    handling: 'hall_slettet',
    entitet: 'haller',
    entitet_id: id,
    beskrivelse: `Slettet hall «${hall?.navn ?? 'ukjent'}»`,
  })

  return NextResponse.json({ ok: true })
}
