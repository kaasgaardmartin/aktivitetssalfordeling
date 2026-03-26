import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase'
import KlubbOversikt from '@/components/klubb/KlubbOversikt'

export const dynamic = 'force-dynamic'

export default async function KlubbPage() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('klubb_session')?.value
  if (!raw) redirect('/logg-inn')

  let session: { klubb_id: string; sesong_id: string; exp: string }
  try {
    session = JSON.parse(raw)
    if (new Date(session.exp) < new Date()) redirect('/logg-inn?msg=utlopt')
  } catch {
    redirect('/logg-inn')
  }

  const supabase = createAdminClient()
  const [klubbRes, sesongRes, slotsRes, svarRes, reglRes] = await Promise.all([
    supabase.from('klubber').select('*').eq('id', session.klubb_id).single(),
    supabase.from('sesonger').select('*').eq('id', session.sesong_id).single(),
    supabase.from('tidslots').select('*, haller(id, navn, underlag, merknader, stengedager)').eq('klubb_id', session.klubb_id).eq('sesong_id', session.sesong_id).order('ukedag').order('fra_kl'),
    supabase.from('svar').select('*').eq('klubb_id', session.klubb_id).eq('sesong_id', session.sesong_id),
    supabase.from('regler_info').select('*').order('oppdatert_at', { ascending: false }).limit(1),
  ])

  if (!klubbRes.data || !sesongRes.data) redirect('/logg-inn')

  return (
    <KlubbOversikt
      klubb={klubbRes.data as any}
      sesong={sesongRes.data as any}
      slots={(slotsRes.data ?? []) as any[]}
      svar={(svarRes.data ?? []) as any[]}
      regler={reglRes.data?.[0] ?? null}
    />
  )
}
