import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
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

const profilSchema = z.object({
  kontaktperson: z.string().trim().max(120).optional().nullable(),
  epost: z.string().trim().email().max(200),
  telefon: z.string().trim().max(40).optional().nullable(),
  medlemstall: z.number().int().min(0).max(100000).optional().nullable(),
  andel_barn: z.number().min(0).max(1).optional().nullable(),
})

// GET — hent klubbens egen profil
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('klubber')
    .select('id, navn, idrett, epost, kontaktperson, telefon, medlemstall, andel_barn')
    .eq('id', session.klubb_id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH — klubb oppdaterer egen profil
export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const body = await request.json()
  const parsed = profilSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('klubber')
    .update({
      kontaktperson: parsed.data.kontaktperson ?? null,
      epost: parsed.data.epost,
      telefon: parsed.data.telefon ?? null,
      medlemstall: parsed.data.medlemstall ?? null,
      andel_barn: parsed.data.andel_barn ?? null,
    })
    .eq('id', session.klubb_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
