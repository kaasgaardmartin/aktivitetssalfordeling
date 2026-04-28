import { createAdminClient } from '@/lib/supabase'
import AdminDashboard from '@/components/admin/AdminDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = createAdminClient()

  const [hallerRes, sesongerRes, klubberRes] = await Promise.all([
    supabase.from('haller').select('*').eq('aktiv', true).order('navn'),
    supabase.from('sesonger').select('*').order('opprettet_at', { ascending: false }),
    supabase.from('klubber').select('*').eq('aktiv', true).order('navn'),
  ])

  const sesonger = (sesongerRes.data ?? []) as any[]
  const aktivSesong = sesonger.find((s: any) => s.status === 'aktiv') ?? sesonger[0] ?? null

  let slots: any[] = []
  if (aktivSesong) {
    const pageSize = 1000
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('tidslots')
        .select('*, haller(id, navn, underlag), klubber(id, navn, idrett)')
        .eq('sesong_id', aktivSesong.id)
        .order('ukedag').order('fra_kl')
        .range(from, from + pageSize - 1)
      if (error || !data || data.length === 0) break
      slots.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }
  }

  return (
    <AdminDashboard
      haller={hallerRes.data ?? []}
      sesonger={sesonger}
      aktivSesong={aktivSesong}
      slots={slots}
      klubber={klubberRes.data ?? []}
    />
  )
}
