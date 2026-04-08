import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 500)
  const entitet = searchParams.get('entitet')

  const supabase = createAdminClient()
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('tidsstempel', { ascending: false })
    .limit(limit)
  if (entitet) query = query.eq('entitet', entitet)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
