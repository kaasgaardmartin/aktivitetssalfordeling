import { NextResponse } from 'next/server'
import { createServerClientInstance, createAdminClient } from '@/lib/supabase'

// POST /api/admin/logg-inn — verify that the logged-in user is an admin
export async function POST() {
  const supabase = await createServerClientInstance()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })
  }

  // Check admin_brukere table
  const admin = createAdminClient()
  const { data: adminRow } = await admin
    .from('admin_brukere')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!adminRow) {
    return NextResponse.json({ error: 'Ikke admin' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/logg-inn — sign out
export async function DELETE() {
  const supabase = await createServerClientInstance()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
