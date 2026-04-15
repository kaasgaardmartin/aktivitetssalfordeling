import ExcelJS from 'exceljs'
import type { Hall, Slot } from './types'
import { UKEDAG_ORDER, TIME_ROWS } from './types'

const UKEDAG_LABEL: Record<string, string> = {
  mandag: 'Mandag',
  tirsdag: 'Tirsdag',
  onsdag: 'Onsdag',
  torsdag: 'Torsdag',
  fredag: 'Fredag',
}

// Map idrett til ARGB-farger (FF + RGB hex)
const IDRETT_FILLS: Record<string, string> = {
  kickboksing: 'FFDBEAFE',  // blue-100
  boksing: 'FFFEF3C7',      // amber-100
  kampsport: 'FFF3E8FF',    // purple-100
  judo: 'FFDCFCE7',         // green-100
  bryting: 'FFFFEDD5',      // orange-100
  dans: 'FFFCE7F3',         // pink-100
  fekting: 'FFCCFBF1',      // teal-100
  bordtennis: 'FFCFFAFE',   // cyan-100
}

function getIdrettFill(idrett?: string | null): string {
  const key = (idrett ?? '').toLowerCase()
  for (const [k, color] of Object.entries(IDRETT_FILLS)) {
    if (key.includes(k)) return color
  }
  return 'FFF3F4F6' // gray-100 fallback
}

function formatTime(t: string) {
  return t?.slice(0, 5) ?? ''
}

const HEADER_FILL = 'FF1F2937'      // gray-800
const HEADER_FONT = 'FFFFFFFF'      // white
const TIME_FILL = 'FFF9FAFB'        // gray-50
const UNAVAILABLE_FILL = 'FFE5E7EB' // gray-200
const FREE_FILL = 'FFFFFFFF'        // white
const BORDER_COLOR = 'FFD1D5DB'     // gray-300

function thinBorder() {
  return {
    top: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
    left: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
    right: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  }
}

export async function exportHallerExcel(haller: Hall[], slots: Slot[]) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Aktivitetssaler Oslo'
  wb.created = new Date()

  for (const hall of haller) {
    const halSlots = slots.filter(s => s.hal_id === hall.id)
    if (halSlots.length === 0) continue

    let sheetName = hall.navn.length > 31 ? hall.navn.slice(0, 31) : hall.navn
    let suffix = 2
    const baseName = sheetName
    while (wb.worksheets.find(w => w.name === sheetName)) {
      sheetName = baseName.slice(0, 28) + ` (${suffix})`
      suffix++
    }
    const ws = wb.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
    })

    // Header row
    const headerRow = ws.addRow(['Tid', ...UKEDAG_ORDER.map(d => UKEDAG_LABEL[d])])
    headerRow.height = 24
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = thinBorder()
    })

    // Data rows
    for (const time of TIME_ROWS) {
      const rowData: (string | null)[] = [time]
      const rowMeta: ({ fill: string; bold?: boolean } | null)[] = [{ fill: TIME_FILL, bold: true }]

      for (const dag of UKEDAG_ORDER) {
        const slot = halSlots.find(s => s.ukedag === dag && formatTime(s.fra_kl) === time)
        if (!slot) {
          rowData.push('')
          rowMeta.push(null)
        } else if (slot.status === 'utilgjengelig') {
          rowData.push('Ikke tilgjengelig')
          rowMeta.push({ fill: UNAVAILABLE_FILL })
        } else if (slot.klubb_id && slot.klubber) {
          const idrett = slot.idrett ?? slot.klubber.idrett
          rowData.push(slot.klubber.navn + (idrett ? ` (${idrett})` : ''))
          rowMeta.push({ fill: getIdrettFill(idrett) })
        } else {
          rowData.push('Ledig')
          rowMeta.push({ fill: FREE_FILL })
        }
      }

      const row = ws.addRow(rowData)
      row.height = 22
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const meta = rowMeta[colNumber - 1]
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left', wrapText: true }
        cell.border = thinBorder()
        cell.font = { size: 10, bold: meta?.bold }
        if (meta?.fill) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: meta.fill } }
        }
      })
    }

    ws.getColumn(1).width = 8
    for (let i = 2; i <= UKEDAG_ORDER.length + 1; i++) {
      ws.getColumn(i).width = 32
    }
  }

  // Sammendragsfane: ledig kapasitet
  const summaryWs = wb.addWorksheet('Ledig kapasitet', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  const sumHeader = summaryWs.addRow(['Hall', 'Dag', 'Ledig fra', 'Ledig til', 'Varighet'])
  sumHeader.height = 24
  sumHeader.eachCell(cell => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = thinBorder()
  })

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
        const fraMin = parseInt(p.fra.split(':')[0]) * 60 + parseInt(p.fra.split(':')[1])
        const tilMin = parseInt(p.til.split(':')[0]) * 60 + parseInt(p.til.split(':')[1])
        const varighet = (tilMin - fraMin) / 60
        const r = summaryWs.addRow([hall.navn, UKEDAG_LABEL[dag], p.fra, p.til, `${varighet}t`])
        r.eachCell(cell => {
          cell.font = { size: 10 }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } } // green-100
          cell.border = thinBorder()
          cell.alignment = { vertical: 'middle' }
        })
      }
    }
  }

  summaryWs.getColumn(1).width = 36
  summaryWs.getColumn(2).width = 12
  summaryWs.getColumn(3).width = 12
  summaryWs.getColumn(4).width = 12
  summaryWs.getColumn(5).width = 10

  // Last ned
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'aktivitetssaler_fordeling.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}
