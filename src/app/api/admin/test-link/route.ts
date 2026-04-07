import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { z } from 'zod'

const schema = z.object({
  klubb_id: z.string().uuid(),
  sesong_id: z.string().uuid(),
})

// POST /api/admin/test-link — generate a magic link for testing (admin only)
// Returns the URL directly without sending email
export async function POST(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createAdminClient()

  const { data: link, error } = await supabase
    .from('magic_links')
    .insert({ klubb_id: parsed.data.klubb_id, sesong_id: parsed.data.sesong_id })
    .select('token')
    .single()

  if (error || !link) {
    return NextResponse.json({ error: error?.message ?? 'Kunne ikke lage lenke' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const url = `${appUrl}/api/magic-link?token=${link.token}`

  return NextResponse.json({ url, token: link.token })
}
