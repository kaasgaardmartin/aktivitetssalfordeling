import { createAdminClient } from '@/lib/supabase'
import AdminDashboard from '@/components/admin/AdminDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = createAdminClient()
  const [hallerRes, sesongerRes, soknaderRes, ventelisteRes, klubberRes] = await Promise.all([
    supabase.from('haller').select('*').eq('aktiv', true).order('navn'),
    supabase.from('sesonger').select('*').order('opprettet_at', { ascending: false }),
    supabase.from('soknader_med_info').select('*').eq('status', 'venter').order('opprettet_at'),
    supabase.from('venteliste').select('*, klubber(id, navn, idrett, medlemstall), haller(id, navn)').eq('status', 'aktiv').order('meldt_dato'),
    supabase.from('klubber').select('*').eq('aktiv', true).order('navn'),
  ])
  const sesonger = (sesongerRes.data ?? []) as any[]
  const aktivSesong = sesonger.find((s: any) => s.status === 'aktiv') ?? sesonger[0] ?? null
  let slots: any[] = []
  let endringer: any[] = []
  if (aktivSesong) {
    const [slotsRes, endringerRes] = await Promise.all([
      supabase.from('tidslots').select('*, haller(id, navn, underlag), klubber(id, navn, idrett)').eq('sesong_id', aktivSesong.id).order('ukedag').order('fra_kl').range(0, 9999),
      supabase.from('svar').select('*, klubber(id, navn, idrett), tidslots(id, ukedag, fra_kl, til_kl, hal_id, haller(id, navn))').eq('sesong_id', aktivSesong.id).eq('handling', 'endre'),
    ])
    slots = slotsRes.data ?? []
    endringer = endringerRes.data ?? []
  }
  return (
    <AdminDashboard haller={hallerRes.data ?? []} sesonger={sesonger} aktivSesong={aktivSesong} slots={slots} soknader={soknaderRes.data ?? []} venteliste={ventelisteRes.data ?? []} klubber={klubberRes.data ?? []} endringer={endringer} />
  )
}
