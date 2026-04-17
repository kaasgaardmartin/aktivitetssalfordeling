import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'

const UKEDAG_ORDER = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag'] as const
const TIME_ROWS = ['15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30']

function nextTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const total = h * 60 + m + 30
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export async function POST() {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const supabase = createAdminClient()

  const { data: sesong } = await supabase
    .from('sesonger')
    .select('id, laast')
    .eq('status', 'aktiv')
    .maybeSingle()

  if (!sesong) return NextResponse.json({ error: 'Ingen aktiv sesong' }, { status: 400 })
  if (sesong.laast) return NextResponse.json({ error: 'Sesongen er låst — åpne den før du fyller inn slotter' }, { status: 400 })

  const { data: haller } = await supabase
    .from('haller')
    .select('id')
    .eq('aktiv', true)

  if (!haller?.length) return NextResponse.json({ error: 'Ingen aktive haller' }, { status: 400 })

  // Hent alle eksisterende slots (paginert pga max-rows = 1000)
  let existingSlots: Array<{ hal_id: string; ukedag: string; fra_kl: string }> = []
  let from = 0
  while (true) {
    const { data } = await supabase
      .from('tidslots')
      .select('hal_id, ukedag, fra_kl')
      .eq('sesong_id', sesong.id)
      .range(from, from + 999)
    if (!data || data.length === 0) break
    existingSlots = existingSlots.concat(data)
    if (data.length < 1000) break
    from += 1000
  }

  const existingSet = new Set(
    existingSlots.map(s => `${s.hal_id}|${s.ukedag}|${s.fra_kl.slice(0, 5)}`)
  )

  // Bygg liste over manglende slots
  const toInsert: Array<{ hal_id: string; sesong_id: string; ukedag: string; fra_kl: string; til_kl: string }> = []
  for (const hall of haller) {
    for (const ukedag of UKEDAG_ORDER) {
      for (const fra_kl of TIME_ROWS) {
        const key = `${hall.id}|${ukedag}|${fra_kl}`
        if (!existingSet.has(key)) {
          toInsert.push({ hal_id: hall.id, sesong_id: sesong.id, ukedag, fra_kl, til_kl: nextTime(fra_kl) })
        }
      }
    }
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, created: 0 })
  }

  // Sett inn i bolker på 200
  const BATCH = 200
  let created = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await supabase.from('tidslots').insert(toInsert.slice(i, i + BATCH) as any)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    created += Math.min(BATCH, toInsert.length - i)
  }

  return NextResponse.json({ ok: true, created })
}
