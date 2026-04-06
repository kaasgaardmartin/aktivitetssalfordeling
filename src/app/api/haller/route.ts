import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// GET /api/haller — list all active halls
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

// POST /api/haller — create hall (admin)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('haller')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/haller — update hall (admin)
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, ...update } = body
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('haller')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/haller — soft-delete hall (set aktiv = false) and remove its slots
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Mangler id' }, { status: 400 })

  const supabase = createAdminClient()

  // Delete all time slots for this hall
  await supabase.from('tidslots').delete().eq('hal_id', id)

  // Soft-delete the hall
  const { error } = await supabase
    .from('haller')
    .update({ aktiv: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
