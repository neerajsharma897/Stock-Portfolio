// Parses AMFI's NAVAll.txt (https://portal.amfiindia.com/spages/NAVAll.txt).
//
// Format, checked against the real file in September 2026:
//   Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date
//   Open Ended Schemes(Equity Scheme - Flexi Cap Fund)        <- category header
//   PPFAS Mutual Fund                                          <- fund house
//   122639;INF879O01027;-;Parag Parikh Flexi Cap Fund;Direct Plan;Growth;89.5712;11-Sep-2026
// Plan and Option are blank for many older funds, Option has hundreds of
// wordings, missing ISINs are "-" (sometimes "Redeemed"), NAVs have 0-8
// decimals (some "10."), and dates are dd-Mon-yyyy.

export type MfPlan = "direct" | "regular"
export type MfOption = "growth" | "idcw"

export type SchemeRecord = {
  amfi_code: number
  name: string
  amc: string
  category: string | null
  scheme_type: string | null
  plan: MfPlan | null
  option_type: MfOption | null
  option_label: string | null
  isin_growth: string | null
  isin_reinvest: string | null
  nav: number | null
  nav_date: string | null
}

const ISIN = /^INF[0-9A-Z]{9}$/
const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
}

/** "11-Sep-2026" → "2026-09-11"; anything else → null. */
export function parseAmfiDate(value: string): string | null {
  const match = value.trim().match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/)
  if (!match) return null
  const month =
    MONTHS[match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase()]
  return month ? `${match[3]}-${month}-${match[1]}` : null
}

function isin(value: string): string | null {
  const trimmed = value.trim()
  return ISIN.test(trimmed) ? trimmed : null
}

function nav(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d*)?$/.test(trimmed)) return null
  const number = Number(trimmed)
  return number > 0 ? number : null
}

/** From the Plan column, or the fund name when the column is blank. */
export function normalisePlan(planColumn: string, name: string): MfPlan | null {
  const text = planColumn.trim() || name
  if (/\bdirect\b/i.test(text)) return "direct"
  if (/\bregular\b/i.test(text)) return "regular"
  return null
}

/** Growth or IDCW from the Option column, or the fund name when the column is blank. */
export function normaliseOption(
  optionColumn: string,
  name: string,
): { option_type: MfOption | null; option_label: string | null } {
  const label = optionColumn.trim() || null
  const text = label ?? name
  // Check growth first: names like "Dividend Yield Fund - Growth" are growth funds.
  const option_type = /growth/i.test(text)
    ? "growth"
    : /idcw|dividend|income distribution|payout|re-?invest/i.test(text)
      ? "idcw"
      : null
  return { option_type, option_label: label }
}

export function parseAmfiNav(text: string): SchemeRecord[] {
  const records = new Map<number, SchemeRecord>()
  let category: string | null = null
  let schemeType: string | null = null
  let amc = ""

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("Scheme Code")) continue

    if (/^\d+;/.test(line)) {
      const parts = line.split(";")
      if (parts.length !== 8) continue
      const [
        code,
        isinGrowth,
        isinReinvest,
        rawName,
        plan,
        option,
        rawNav,
        date,
      ] = parts
      const name = rawName.trim()
      if (!name) continue

      const amfiCode = Number(code)
      records.set(amfiCode, {
        amfi_code: amfiCode,
        name,
        amc: amc || "Unknown fund house",
        category,
        scheme_type: schemeType,
        plan: normalisePlan(plan, name),
        ...normaliseOption(option, name),
        isin_growth: isin(isinGrowth),
        isin_reinvest: isin(isinReinvest),
        nav: nav(rawNav),
        nav_date: parseAmfiDate(date),
      })
      continue
    }

    const header = line.match(/^(.*?)\s*Schemes\s*\((.*)\)$/)
    if (header) {
      schemeType = header[1].trim() || null
      category = header[2].trim() || null
      amc = ""
    } else {
      amc = line
    }
  }

  return [...records.values()]
}
