import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { z } from 'zod'

const sesongCreateSchema = z.object({
  navn: z.string().min(3, 'Sesongnavn må ha minst 3 tegn'),
  frist: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ugyldig datoformat'),
  kopier_fra_sesong_id: z.string().uuid().optional(),
})

const sesongUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['utkast', 'aktiv', 'lukket']).optional(),
  frist: z.string().optional(),
  navn: z.string().min(3).optional(),
})

// GET /api/sesonger — list all seasons
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sesonger')
    .select('*')
    .order('opprettet_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/sesonger — create new season, optionally copy slots from previous
export async function POST(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const body = await request.json()
  const parsed = sesongCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createAdminClient()

  const { data: sesong, error } = await supabase
    .from('sesonger')
    .insert({ navn: parsed.data.navn, frist: parsed.data.frist, status: 'utkast' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (parsed.data.kopier_fra_sesong_id) {
    const { data: forrigeSlots, error: slotErr } = await supabase
      .from('tidslots')
      .select('hal_id, ukedag, fra_kl, til_kl, klubb_id')
      .eq('sesong_id', parsed.data.kopier_fra_sesong_id)

    if (slotErr) return NextResponse.json({ error: slotErr.message }, { status: 500 })

    if (forrigeSlots && forrigeSlots.length > 0) {
      const nyeSlots = forrigeSlots.map(s => ({
        hal_id: s.hal_id,
        ukedag: s.ukedag,
        fra_kl: s.fra_kl,
        til_kl: s.til_kl,
        klubb_id: s.klubb_id,
        sesong_id: sesong.id,
      }))

      const { error: insertErr } = await supabase.from('tidslots').insert(nyeSlots)
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }
  }

  return NextResponse.json(sesong, { status: 201 })
}

// PATCH /api/sesonger — update status or frist
export async function PATCH(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const body = await request.json()
  const parsed = sesongUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { id, ...update } = parsed.data
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sesonger')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
