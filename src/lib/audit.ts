import { createAdminClient } from '@/lib/supabase'

export interface AuditEntry {
  admin_id?: string | null
  admin_epost?: string | null
  handling: string
  entitet?: string | null
  entitet_id?: string | null
  beskrivelse?: string | null
  metadata?: Record<string, any> | null
}

// Ikke kast feil — audit-logging skal aldri blokkere en forretningshandling
export async function logAudit(entry: AuditEntry) {
  try {
    const supabase = createAdminClient()
    await supabase.from('audit_log').insert({
      admin_id: entry.admin_id ?? null,
      admin_epost: entry.admin_epost ?? null,
      handling: entry.handling,
      entitet: entry.entitet ?? null,
      entitet_id: entry.entitet_id ?? null,
      beskrivelse: entry.beskrivelse ?? null,
      metadata: entry.metadata ?? null,
    })
  } catch (e) {
    console.error('[audit] klarte ikke logge:', e)
  }
}
