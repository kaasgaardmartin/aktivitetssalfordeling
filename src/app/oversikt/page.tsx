import { createAdminClient } from '@/lib/supabase'
import OversiktClient from './OversiktClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = createAdminClient()

  const { data: aktivSesong } = await supabase
    .from('sesonger')
    .select('id, navn, frist, status, laast')
    .eq('status', 'aktiv')
    .maybeSingle()

  const sesong = aktivSesong ?? null

  const hallerRes = await supabase
    .from('haller')
    .select('id, navn, adresse, postnummer, poststed, lat, lng, kilde_url')
    .eq('aktiv', true)
    .order('navn')

  // Supabase har en absolutt max-rows-grense (default 1000) som ikke kan overstyres med .range().
  // Vi henter derfor i sider à 1000 til alle rader er hentet.
  let allSlots: any[] = []
  if (sesong) {
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tidslots')
        .select('id, hal_id, ukedag, fra_kl, til_kl, klubb_id, idrett, status, klubber(id, navn, idrett)')
        .eq('sesong_id', sesong.id)
        .order('ukedag')
        .order('fra_kl')
        .range(from, from + PAGE - 1)
      if (error || !data || data.length === 0) break
      allSlots = allSlots.concat(data)
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  const haller = hallerRes.data ?? []
  const slots = allSlots

  return <OversiktClient haller={haller} slots={slots} sesong={sesong} />
}
