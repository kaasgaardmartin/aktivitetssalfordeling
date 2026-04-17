import { createAdminClient } from '@/lib/supabase'
import LedigClient from './LedigClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ledige tider — Aktivitetssaler Oslo' }

export default async function LedigPage() {
  const supabase = createAdminClient()

  const { data: aktivSesong } = await supabase
    .from('sesonger')
    .select('id, navn, frist, status, laast')
    .eq('status', 'aktiv')
    .maybeSingle()

  let allSlots: any[] = []
  if (aktivSesong) {
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tidslots')
        .select('id, hal_id, ukedag, fra_kl, til_kl, klubb_id, status, haller(id, navn, adresse, poststed)')
        .eq('sesong_id', aktivSesong.id)
        .order('ukedag')
        .order('fra_kl')
        .range(from, from + PAGE - 1)
      if (error || !data || data.length === 0) break
      allSlots = allSlots.concat(data)
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  return <LedigClient slots={allSlots} sesong={aktivSesong ?? null} />
}
