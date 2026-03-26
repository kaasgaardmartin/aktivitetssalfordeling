import { createAdminClient } from '@/lib/supabase'
import ReglerEditor from './ReglerEditor'
export const dynamic = 'force-dynamic'
export default async function AdminReglerPage() {
  const supabase = createAdminClient()
  const { data } = await supabase.from('regler_info').select('*').order('oppdatert_at', { ascending: false }).limit(1).single()
  return <ReglerEditor regler={data} />
}
