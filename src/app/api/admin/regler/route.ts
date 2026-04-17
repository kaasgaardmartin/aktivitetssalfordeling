import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'

// GET /api/admin/regler — fetch current rules
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('regler_info')
    .select('*')
    .order('oppdatert_at', { ascending: false })
    .limit(1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/admin/regler — update rules text
export async function PATCH(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const body = await request.json()
  const { id, innhold } = body

  if (!id || typeof innhold !== 'string') {
    return NextResponse.json({ error: 'Mangler id eller innhold' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('regler_info')
    .update({ innhold, oppdatert_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
