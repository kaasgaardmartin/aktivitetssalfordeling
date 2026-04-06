import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'

// GET /api/tidslots?sesong_id=&hal_id=&klubb_id=
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sesongId = searchParams.get('sesong_id')
  const halId = searchParams.get('hal_id')
  const klubbId = searchParams.get('klubb_id')
  const ledig = searchParams.get('ledig') // 'true' for empty slots only

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
  const supabase = createAdminClient()

  // Accept single object or array
  const slots = Array.isArray(body) ? body : [body]

  const { data, error } = await supabase
    .from('tidslots')
    .insert(slots)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/tidslots — admin updates slot (reassign club)
export async function PATCH(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const body = await request.json()
  const { id, klubb_id } = body

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tidslots')
    .update({ klubb_id: klubb_id ?? null })
    .eq('id', id)
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
  if (!id) return NextResponse.json({ error: 'Mangler id' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('tidslots').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
