import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

async function getSession() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('klubb_session')?.value
  if (!raw) return null
  try {
    const s = JSON.parse(raw)
    if (new Date(s.exp) < new Date()) return null
    return s as { klubb_id: string; sesong_id: string }
  } catch { return null }
}

// GET /api/klubb/soknader — hent klubbens egne søknader med slot/hall-info
export async function GET(_request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('soknader')
    .select('id, status, gruppe, begrunnelse, opprettet_at, behandlet_at, tidslots(id, ukedag, fra_kl, til_kl, haller(id, navn))')
    .eq('klubb_id', session.klubb_id)
    .eq('sesong_id', session.sesong_id)
    .order('opprettet_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
