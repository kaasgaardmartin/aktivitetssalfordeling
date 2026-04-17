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
  laast: z.boolean().optional(),
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
    // Hent alle slots fra forrige sesong (paginert — Supabase har max 1000 rader per kall)
    let forrigeSlots: any[] = []
    let from = 0
    while (true) {
      const { data, error: slotErr } = await supabase
        .from('tidslots')
        .select('hal_id, ukedag, fra_kl, til_kl, klubb_id, idrett, status')
        .eq('sesong_id', parsed.data.kopier_fra_sesong_id)
        .range(from, from + 999)

      if (slotErr) return NextResponse.json({ error: slotErr.message }, { status: 500 })
      if (!data || data.length === 0) break
      forrigeSlots = forrigeSlots.concat(data)
      if (data.length < 1000) break
      from += 1000
    }

    if (forrigeSlots.length > 0) {
      const nyeSlots = forrigeSlots.map(s => ({
        hal_id: s.hal_id,
        ukedag: s.ukedag,
        fra_kl: s.fra_kl,
        til_kl: s.til_kl,
        klubb_id: s.klubb_id,
        idrett: s.idrett,
        status: s.status,
        sesong_id: sesong.id,
      }))

      // Sett inn i bolker på 200 for å unngå payload-grenser
      const BATCH = 200
      for (let i = 0; i < nyeSlots.length; i += BATCH) {
        const { error: insertErr } = await supabase
          .from('tidslots')
          .insert(nyeSlots.slice(i, i + BATCH) as any)
        if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
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
