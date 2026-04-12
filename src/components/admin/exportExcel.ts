import * as XLSX from 'xlsx'
import type { Hall, Slot } from './types'
import { UKEDAG_ORDER, TIME_ROWS } from './types'

const UKEDAG_LABEL: Record<string, string> = {
  mandag: 'Mandag',
  tirsdag: 'Tirsdag',
  onsdag: 'Onsdag',
  torsdag: 'Torsdag',
  fredag: 'Fredag',
}

// Map idrett to Excel fill colors (ARGB without alpha)
const IDRETT_FILLS: Record<string, string> = {
  kickboksing: 'DBEAFE',  // blue-100
  boksing: 'FEF3C7',      // amber-100
  kampsport: 'F3E8FF',    // purple-100
  judo: 'DCFCE7',         // green-100
  bryting: 'FFEDD5',      // orange-100
  dans: 'FCE7F3',         // pink-100
  fekting: 'CCFBF1',      // teal-100
  bordtennis: 'CFFAFE',   // cyan-100
}

function getIdrettFill(idrett?: string | null): string | null {
  const key = (idrett ?? '').toLowerCase()
  for (const [k, color] of Object.entries(IDRETT_FILLS)) {
    if (key.includes(k)) return color
  }
  return null
}

function formatTime(t: string) {
  return t?.slice(0, 5) ?? ''
}

export function exportHallerExcel(haller: Hall[], slots: Slot[]) {
  const wb = XLSX.utils.book_new()

  for (const hall of haller) {
    const halSlots = slots.filter(s => s.hal_id === hall.id)
    if (halSlots.length === 0) continue

    // Build grid: rows = TIME_ROWS, cols = ukedager
    const header = ['Tid', ...UKEDAG_ORDER.map(d => UKEDAG_LABEL[d])]
    const rows: string[][] = []

    for (const time of TIME_ROWS) {
      const row = [time]
      for (const dag of UKEDAG_ORDER) {
        const slot = halSlots.find(s => s.ukedag === dag && formatTime(s.fra_kl) === time)
        if (!slot) {
          row.push('')
        } else if (slot.status === 'utilgjengelig') {
          row.push('Ikke tilgj.')
        } else if (slot.klubb_id && slot.klubber) {
          const idrett = slot.idrett ?? slot.klubber.idrett
          row.push(slot.klubber.navn + (idrett ? ` (${idrett})` : ''))
        } else {
          row.push('Ledig')
        }
      }
      rows.push(row)
    }

    const wsData = [header, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Column widths
    ws['!cols'] = [
      { wch: 6 },
      ...UKEDAG_ORDER.map(() => ({ wch: 28 })),
    ]

    // Truncate sheet name to 31 chars (Excel limit)
    let sheetName = hall.navn.length > 31 ? hall.navn.slice(0, 31) : hall.navn
    // Ensure unique name
    let suffix = 2
    const baseName = sheetName
    while (wb.SheetNames.includes(sheetName)) {
      sheetName = baseName.slice(0, 28) + ` (${suffix})`
      suffix++
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  // Also add a "Ledig kapasitet" summary sheet
  const summaryHeader = ['Hall', 'Dag', 'Ledig fra', 'Ledig til']
  const summaryRows: string[][] = []

  for (const hall of haller) {
    const halSlots = slots.filter(s => s.hal_id === hall.id)
    for (const dag of UKEDAG_ORDER) {
      const dagSlots = halSlots.filter(s => s.ukedag === dag)
      const opptattTider = new Set(
        dagSlots
          .filter(s => s.klubb_id || s.status === 'utilgjengelig')
          .map(s => formatTime(s.fra_kl))
      )
      const ledigeTider = TIME_ROWS.filter(t => !opptattTider.has(t)).sort()

      // Grupper sammenhengende
      const perioder: { fra: string; til: string }[] = []
      for (const t of ledigeTider) {
        const mins = parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]) + 30
        const til = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
        const last = perioder[perioder.length - 1]
        if (last && last.til === t) {
          last.til = til
        } else {
          perioder.push({ fra: t, til })
        }
      }

      for (const p of perioder) {
        summaryRows.push([hall.navn, UKEDAG_LABEL[dag], p.fra, p.til])
      }
    }
  }

  const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows])
  summaryWs['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Ledig kapasitet')

  XLSX.writeFile(wb, 'aktivitetssaler_fordeling.xlsx')
}
