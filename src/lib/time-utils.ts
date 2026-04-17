/**
 * Deler et tidsintervall (fra_kl..til_kl, format HH:MM) opp i 30-minutters blokker.
 * Returnerer array av { fra_kl, til_kl } i HH:MM-format.
 */
export function generate30minSlots(fra: string, til: string): { fra_kl: string; til_kl: string }[] {
  const slots: { fra_kl: string; til_kl: string }[] = []
  const [fH, fM] = fra.slice(0, 5).split(':').map(Number)
  const [tH, tM] = til.slice(0, 5).split(':').map(Number)
  let cur = fH * 60 + fM
  const end = tH * 60 + tM
  while (cur + 30 <= end) {
    const h1 = String(Math.floor(cur / 60)).padStart(2, '0')
    const m1 = String(cur % 60).padStart(2, '0')
    const h2 = String(Math.floor((cur + 30) / 60)).padStart(2, '0')
    const m2 = String((cur + 30) % 60).padStart(2, '0')
    slots.push({ fra_kl: `${h1}:${m1}`, til_kl: `${h2}:${m2}` })
    cur += 30
  }
  return slots
}
