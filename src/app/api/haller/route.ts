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
