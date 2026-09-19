// NSE's index lists ("Company Name,Industry,Symbol,Series,ISIN Code") as
// symbol → sector. Company names can contain commas inside quotes.

export type SectorRow = { symbol: string; sector: string }

/** Splits one CSV line, honouring double quotes ("" inside quotes is a quote). */
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      cells.push(cell)
      cell = ""
    } else {
      cell += char
    }
  }
  cells.push(cell)
  return cells.map((value) => value.trim())
}

/** Rows with a symbol and industry; the header decides which columns they are. */
export function parseSectorCsv(text: string): SectorRow[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/)
  const header = splitCsvLine(lines[0] ?? "").map((cell) => cell.toLowerCase())
  const symbolAt = header.indexOf("symbol")
  const sectorAt = header.indexOf("industry")
  if (symbolAt < 0 || sectorAt < 0) return []

  const rows = new Map<string, SectorRow>()
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cells = splitCsvLine(line)
    const symbol = cells[symbolAt]?.toUpperCase()
    const sector = cells[sectorAt]
    if (!symbol || !sector || symbol.length > 40 || sector.length > 60) continue
    rows.set(symbol, { symbol, sector })
  }
  return [...rows.values()]
}
