import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'
import { cookies } from 'next/headers'
import { z } from 'zod'

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

const ventelisteSchema = z.object({
  idrett: z.string().optional(),
  oensket_hal_id: z.string().uuid().optional(),
  gruppe: z.enum(['barn', 'voksne', 'begge']).optional(),
})

// GET /api/venteliste — admin lists all
export async function GET() {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('venteliste')
    .select('*, klubber(id, navn, idrett, medlemstall), haller(id, navn)')
    .eq('status', 'aktiv')
    .order('meldt_dato', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/venteliste — logged-in club adds itself to waitlist
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const body = await request.json()
  const parsed = ventelisteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('venteliste')
    .insert({ ...parsed.data, klubb_id: session.klubb_id, status: 'aktiv' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// PATCH /api/venteliste — admin marks as tildelt/inaktiv
export async function PATCH(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const body = await request.json()
  const { id, status } = body as { id: string; status: 'tildelt' | 'inaktiv' }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('venteliste')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
