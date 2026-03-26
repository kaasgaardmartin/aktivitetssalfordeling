import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase'
import KlubbOversikt from '@/components/klubb/KlubbOversikt'
import { redirect } from 'next/navigation'

async function getSessionData() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('klubb_session')?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as { klubb_id: string; sesong_id: string }
  } catch { return null }
}

export default async function KlubbPage() {
  const session = await getSessionData()
  if (!session) redirect('/logg-inn')

  const supabase = createAdminClient()

  // Fetch all data in parallel
  const [klubbRes, sesongRes, slotsRes, svarRes, reglRes] = await Promise.all([
    supabase.from('klubber').select('*').eq('id', session.klubb_id).single(),
    supabase.from('sesonger').select('*').eq('id', session.sesong_id).single(),
    supabase
      .from('tidslots')
      .select('*, haller(id, navn, underlag, merknader, stengedager, bilder)')
      .eq('klubb_id', session.klubb_id)
      .eq('sesong_id', session.sesong_id)
      .order('ukedag').order('fra_kl'),
    supabase
      .from('svar')
      .select('*')
      .eq('klubb_id', session.klubb_id)
      .eq('sesong_id', session.sesong_id),
    supabase.from('regler_info').select('*').order('oppdatert_at', { ascending: false }).limit(1),
  ])

  return (
    <KlubbOversikt
      klubb={klubbRes.data!}
      sesong={sesongRes.data!}
      slots={slotsRes.data ?? []}
      svar={svarRes.data ?? []}
      regler={reglRes.data?.[0] ?? null}
    />
  )
}
