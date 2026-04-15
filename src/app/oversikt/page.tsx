import { createAdminClient } from '@/lib/supabase'
import OversiktClient from './OversiktClient'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export default async function Page() {
  const supabase = createAdminClient()

  const { data: aktivSesong } = await supabase
    .from('sesonger')
    .select('id, navn, frist, status, laast')
    .eq('status', 'aktiv')
    .maybeSingle()

  const sesong = aktivSesong ?? null

  const [hallerRes, slotsRes] = await Promise.all([
    supabase.from('haller').select('id, navn, adresse, poststed').eq('aktiv', true).order('navn'),
    sesong
      ? supabase
          .from('tidslots')
          .select('id, hal_id, ukedag, fra_kl, til_kl, klubb_id, idrett, status, klubber(id, navn, idrett)')
          .eq('sesong_id', sesong.id)
          .order('ukedag')
          .order('fra_kl')
      : Promise.resolve({ data: [] as any[], error: null }),
  ])

  const haller = hallerRes.data ?? []
  const slots = (slotsRes.data ?? []) as any[]

  return <OversiktClient haller={haller} slots={slots} sesong={sesong} />
}
