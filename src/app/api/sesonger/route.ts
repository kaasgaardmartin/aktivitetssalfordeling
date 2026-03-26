import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

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

// POST /api/sesonger — create new season
export async function POST(request: NextRequest) {
  const body = await request.json()
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('sesonger')
    .insert({ navn: body.navn, frist: body.frist, status: 'utkast' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/sesonger — update status or frist
export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const { id, ...update } = body

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
