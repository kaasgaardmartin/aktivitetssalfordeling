import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

/**
 * Sjekk om en sesong er låst. Returnerer NextResponse-feil hvis låst,
 * eller null hvis OK å fortsette.
 *
 * Brukes på alle endepunkter som muterer slots, søknader, svar eller bytter.
 * Når en sesong er låst er tildelingen frossen — ingen kan endre noe inntil
 * admin åpner den igjen.
 */
export async function assertSesongUlast(sesong_id: string | null | undefined): Promise<NextResponse | null> {
  if (!sesong_id) return null
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('sesonger')
    .select('laast, navn')
    .eq('id', sesong_id)
    .single()
  if (error) return null // ikke blokker hvis sesongen ikke finnes — andre sjekker tar det
  if (data?.laast) {
    return NextResponse.json(
      { error: `Sesongen «${data.navn}» er låst. Tildelingen kan ikke endres.` },
      { status: 423 }, // Locked
    )
  }
  return null
}

/**
 * Sjekk lås gitt et tidslot-id (slår opp sesong_id selv).
 */
export async function assertSlotUlast(slot_id: string): Promise<NextResponse | null> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('tidslots').select('sesong_id').eq('id', slot_id).single()
  if (!data?.sesong_id) return null
  return assertSesongUlast(data.sesong_id)
}
