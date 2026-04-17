// Shared types and utilities for admin components

export interface Hall {
  id: string
  navn: string
  underlag: string | null
  merknader: string | null
  adresse: string | null
  postnummer: string | null
  poststed: string | null
  kilde_url: string | null
  lat: number | null
  lng: number | null
  stengedager: string | null
  bilder: string[] | null
  normert_timer: number | null
  aktiv: boolean
  opprettet_at: string
}

export interface Klubb {
  id: string
  navn: string
  idrett: string | null
  epost: string | null
  nif_org_id: string | null
  medlemstall: number | null
  andel_barn: number | null
  ant_0_5: number
  ant_6_12: number
  ant_13_19: number
  ant_20_25: number
  ant_26_pluss: number
  aktiv: boolean
  opprettet_at: string
}

export interface Sesong {
  id: string
  navn: string
  frist: string
  status: 'utkast' | 'aktiv' | 'lukket'
  laast: boolean
  opprettet_av: string | null
  opprettet_at: string
}

export interface Slot {
  id: string
  hal_id: string
  sesong_id: string | null
  ukedag: string
  fra_kl: string
  til_kl: string
  klubb_id: string | null
  idrett: string | null
  status?: 'ledig' | 'utilgjengelig'
  haller?: { id: string; navn: string; underlag: string | null; merknader?: string | null; stengedager?: string | null; adresse?: string | null; postnummer?: string | null; poststed?: string | null; kilde_url?: string | null }
  klubber?: { id: string; navn: string; idrett: string | null } | null
}

export interface Soknad {
  id: string
  slot_id: string
  klubb_id: string
  hal_id: string
  status: string
  gruppe: string
  begrunnelse: string | null
  medlemstall: number | null
  eksisterende_timer: number | null
  hal_navn: string
  klubb_navn: string
  idrett: string | null
  ukedag: string
  fra_kl: string
  til_kl: string
  underlag: string | null
}

export interface Endring {
  id: string
  tidsstempel: string
  kommentar: string | null
  ny_ukedag: string | null
  ny_fra_kl: string | null
  ny_til_kl: string | null
  klubb_id?: string
  tidslot_id?: string
  klubber?: { id?: string; navn: string; idrett: string | null }
  tidslots?: { id?: string; ukedag: string; fra_kl: string; til_kl: string; hal_id?: string; haller?: { id?: string; navn: string } }
}

// En gruppert endring som dekker flere kontigue 30-min slots
export interface EndringGruppe {
  klubb_id: string
  klubb_navn: string
  klubb_idrett: string | null
  hal_id: string
  hal_navn: string
  ukedag: string
  fra_kl: string
  til_kl: string
  ny_ukedag: string | null
  ny_fra_kl: string | null
  ny_til_kl: string | null
  kommentar: string | null
  tidsstempel: string
  endring_ids: string[]
}

function timeToMin(t: string) {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export function groupEndringer(endringer: Endring[]): EndringGruppe[] {
  // Sorter slik at sammenhengende slots kommer etter hverandre
  const sorted = [...endringer].sort((a, b) => {
    const ka = `${a.klubber?.id ?? ''}|${a.tidslots?.haller?.id ?? a.tidslots?.hal_id ?? ''}|${a.tidslots?.ukedag ?? ''}|${a.ny_ukedag ?? ''}|${a.ny_fra_kl ?? ''}|${a.ny_til_kl ?? ''}|${a.kommentar ?? ''}`
    const kb = `${b.klubber?.id ?? ''}|${b.tidslots?.haller?.id ?? b.tidslots?.hal_id ?? ''}|${b.tidslots?.ukedag ?? ''}|${b.ny_ukedag ?? ''}|${b.ny_fra_kl ?? ''}|${b.ny_til_kl ?? ''}|${b.kommentar ?? ''}`
    if (ka !== kb) return ka.localeCompare(kb)
    return timeToMin(a.tidslots?.fra_kl ?? '00:00') - timeToMin(b.tidslots?.fra_kl ?? '00:00')
  })

  const grupper: EndringGruppe[] = []
  for (const e of sorted) {
    const last = grupper[grupper.length - 1]
    const sameKey =
      last &&
      last.klubb_id === (e.klubber?.id ?? '') &&
      last.hal_id === (e.tidslots?.haller?.id ?? e.tidslots?.hal_id ?? '') &&
      last.ukedag === (e.tidslots?.ukedag ?? '') &&
      last.ny_ukedag === e.ny_ukedag &&
      last.ny_fra_kl === e.ny_fra_kl &&
      last.ny_til_kl === e.ny_til_kl &&
      last.kommentar === e.kommentar &&
      timeToMin(last.til_kl) === timeToMin(e.tidslots?.fra_kl ?? '00:00')

    if (sameKey) {
      last.til_kl = e.tidslots?.til_kl ?? last.til_kl
      last.endring_ids.push(e.id)
    } else {
      grupper.push({
        klubb_id: e.klubber?.id ?? '',
        klubb_navn: e.klubber?.navn ?? '',
        klubb_idrett: e.klubber?.idrett ?? null,
        hal_id: e.tidslots?.haller?.id ?? e.tidslots?.hal_id ?? '',
        hal_navn: e.tidslots?.haller?.navn ?? '',
        ukedag: e.tidslots?.ukedag ?? '',
        fra_kl: e.tidslots?.fra_kl ?? '',
        til_kl: e.tidslots?.til_kl ?? '',
        ny_ukedag: e.ny_ukedag,
        ny_fra_kl: e.ny_fra_kl,
        ny_til_kl: e.ny_til_kl,
        kommentar: e.kommentar,
        tidsstempel: e.tidsstempel,
        endring_ids: [e.id],
      })
    }
  }
  return grupper
}

export interface VentelisteItem {
  id: string
  gruppe: string | null
  meldt_dato: string
  status: string
  klubber?: { navn: string }
  haller?: { navn: string }
}

// Constants
export const UKEDAG_ORDER = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag'] as const
export const UKEDAG_SHORT: Record<string, string> = { mandag: 'Man', tirsdag: 'Tir', onsdag: 'Ons', torsdag: 'Tor', fredag: 'Fre' }

export const IDRETT_COLORS: Record<string, string> = {
  kickboksing: 'bg-blue-100 text-blue-900 ring-1 ring-inset ring-blue-300',
  boksing: 'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300',
  kampsport: 'bg-purple-100 text-purple-900 ring-1 ring-inset ring-purple-300',
  judo: 'bg-green-100 text-green-900 ring-1 ring-inset ring-green-300',
  bryting: 'bg-orange-100 text-orange-900 ring-1 ring-inset ring-orange-300',
  dans: 'bg-pink-100 text-pink-900 ring-1 ring-inset ring-pink-300',
  fekting: 'bg-teal-100 text-teal-900 ring-1 ring-inset ring-teal-300',
  bordtennis: 'bg-cyan-100 text-cyan-900 ring-1 ring-inset ring-cyan-300',
}

export const UNDERLAG_OPTIONS = ['Puslematter', 'Brytematter', 'Judomatter', 'Sportsgulv', 'Parkett', 'Kunstdekke', 'Annet']

export const TIME_ROWS = ['15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00','22:30']

// Utilities
export function idrettColor(idrett?: string | null) {
  const key = (idrett ?? '').toLowerCase()
  return Object.entries(IDRETT_COLORS).find(([k]) => key.includes(k))?.[1] ?? 'bg-gray-200 text-gray-900 ring-1 ring-inset ring-gray-400'
}

export function formatTime(t: string) { return t?.slice(0, 5) ?? '' }

export { generate30minSlots } from '@/lib/time-utils'

export function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF'
  const csv = bom + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
