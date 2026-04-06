import { NextResponse } from 'next/server'
import { createServerClientInstance, createAdminClient } from '@/lib/supabase'

/**
 * Verify that the request comes from an authenticated admin user.
 * Returns the admin row if valid, or a NextResponse error to return immediately.
 */
export async function verifyAdmin(): Promise<
  { admin: { id: string }; error?: never } | { admin?: never; error: NextResponse }
> {
  try {
    const serverClient = await createServerClientInstance()
    const { data: { user } } = await serverClient.auth.getUser()

    if (!user) {
      return { error: NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 }) }
    }

    const adminClient = createAdminClient()
    const { data: adminRow } = await adminClient
      .from('admin_brukere')
      .select('id')
      .eq('auth_id', user.id)
      .single()

    if (!adminRow) {
      return { error: NextResponse.json({ error: 'Ikke admin' }, { status: 403 }) }
    }

    return { admin: adminRow }
  } catch {
    return { error: NextResponse.json({ error: 'Auth-feil' }, { status: 500 }) }
  }
}
