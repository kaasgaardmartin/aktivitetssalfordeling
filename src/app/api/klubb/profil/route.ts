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
  ant_0_5: z.number().int().min(0).optional().nullable(),
  ant_6_12: z.number().int().min(0).optional().nullable(),
  ant_13_19: z.number().int().min(0).optional().nullable(),
  ant_20_25: z.number().int().min(0).optional().nullable(),
  ant_26_pluss: z.number().int().min(0).optional().nullable(),
})

// GET — hent klubbens egen profil
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('klubber')
    .select('id, navn, idrett, epost, kontaktperson, telefon, medlemstall, andel_barn, ant_0_5, ant_6_12, ant_13_19, ant_20_25, ant_26_pluss')
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
      ...(parsed.data.ant_0_5 != null && { ant_0_5: parsed.data.ant_0_5 }),
      ...(parsed.data.ant_6_12 != null && { ant_6_12: parsed.data.ant_6_12 }),
      ...(parsed.data.ant_13_19 != null && { ant_13_19: parsed.data.ant_13_19 }),
      ...(parsed.data.ant_20_25 != null && { ant_20_25: parsed.data.ant_20_25 }),
      ...(parsed.data.ant_26_pluss != null && { ant_26_pluss: parsed.data.ant_26_pluss }),
    })
    .eq('id', session.klubb_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
