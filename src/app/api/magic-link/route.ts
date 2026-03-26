import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

// GET /api/magic-link?token=xxx
// Validates token and sets session cookie
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.redirect(new URL('/feil?msg=ingen-token', request.url))

  const supabase = createAdminClient()

  const { data: link, error } = await supabase
    .from('magic_links')
    .select('*, klubber(*), sesonger(*)')
    .eq('token', token)
    .single()

  if (error || !link) return NextResponse.redirect(new URL('/feil?msg=ugyldig-token', request.url))
  if (link.brukt_at && new Date(link.utloper_at) < new Date()) {
    return NextResponse.redirect(new URL('/feil?msg=utlopt-token', request.url))
  }

  // Mark token as used
  await supabase
    .from('magic_links')
    .update({ brukt_at: new Date().toISOString() })
    .eq('id', link.id)

  // Set session cookie (httpOnly, 7 days)
  const cookieStore = await cookies()
  cookieStore.set('klubb_session', JSON.stringify({
    klubb_id: link.klubb_id,
    sesong_id: link.sesong_id,
    token,
    exp: link.utloper_at,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(link.utloper_at),
    path: '/',
  })

  return NextResponse.redirect(new URL('/klubb', request.url))
}
