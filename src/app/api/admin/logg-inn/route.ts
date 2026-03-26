import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Simple password-based admin auth.
// Replace with Supabase Auth + admin role for production.
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { passord } = body

  const adminPassord = process.env.ADMIN_PASSWORD
  if (!adminPassord) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD ikke satt i miljøvariabler' }, { status: 500 })
  }

  if (passord !== adminPassord) {
    return NextResponse.json({ error: 'Feil passord' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set('admin_session', 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_session')
  return NextResponse.json({ ok: true })
}
