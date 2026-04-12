import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { z } from 'zod'

// GET /api/admin/klubber — all clubs with stats
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sesongId = searchParams.get('sesong_id')

  const supabase = createAdminClient()

  const { data: klubber, error } = await supabase
    .from('klubber')
    .select('*')
    .eq('aktiv', true)
    .order('navn')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with slot stats if sesong_id given
  if (sesongId && klubber) {
    const { data: slots } = await supabase
      .from('tidslots')
      .select('klubb_id')
      .eq('sesong_id', sesongId)
      .not('klubb_id', 'is', null)

    const slotCounts = (slots ?? []).reduce((acc, s) => {
      acc[s.klubb_id!] = (acc[s.klubb_id!] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    const { data: svarData } = await supabase
      .from('svar')
      .select('klubb_id, handling')
      .eq('sesong_id', sesongId)

    const svarStatus = (svarData ?? []).reduce((acc, s) => {
      if (!acc[s.klubb_id]) acc[s.klubb_id] = 'besvart'
      return acc
    }, {} as Record<string, string>)

    return NextResponse.json(klubber.map(k => ({
      ...k,
      antall_slots: slotCounts[k.id] ?? 0,
      timer_per_uke: ((slotCounts[k.id] ?? 0) * 0.5).toFixed(1),
      sesong_status: svarStatus[k.id] ?? 'ikke_besvart',
    })))
  }

  return NextResponse.json(klubber)
}

const klubbUpdateSchema = z.object({
  id: z.string().uuid(),
  navn: z.string().min(2).optional(),
  idrett: z.string().optional(),
  epost: z.string().email().optional(),
  medlemstall: z.number().int().min(0).optional(),
  andel_barn: z.number().min(0).max(1).optional(),
  ant_0_5: z.number().int().min(0).optional(),
  ant_6_12: z.number().int().min(0).optional(),
  ant_13_19: z.number().int().min(0).optional(),
  ant_20_25: z.number().int().min(0).optional(),
  ant_26_pluss: z.number().int().min(0).optional(),
})

// PATCH /api/admin/klubber — update club (incl. NIF data manually)
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const parsed = klubbUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { id, ...update } = parsed.data
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('klubber')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/admin/klubber — create new club
export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('klubber')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
