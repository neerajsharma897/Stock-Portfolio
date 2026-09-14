// Indian-style number formatting shared by every screen (₹1,23,456.78, ₹24.6L, ₹1.25Cr).

const MINUS = "−"
const LAKH = 1e5
const CRORE = 1e7

const inrFormatters = new Map<number, Intl.NumberFormat>()

function inrFormatter(decimals: number) {
  let formatter = inrFormatters.get(decimals)
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    inrFormatters.set(decimals, formatter)
  }
  return formatter
}

/** Sign to show, ignoring values that round to zero (so we never print "−₹0.00"). */
function signOf(value: number, decimals: number): -1 | 0 | 1 {
  if (Number(Math.abs(value).toFixed(decimals)) === 0) return 0
  return value < 0 ? -1 : 1
}

function trimZeros(value: string) {
  return value.includes(".") ? value.replace(/\.?0+$/, "") : value
}

export function formatINR(value: number, decimals = 2): string {
  const formatted = inrFormatter(decimals).format(Math.abs(value))
  return signOf(value, decimals) === -1 ? `${MINUS}${formatted}` : formatted
}

/** Like formatINR but always shows "+" for gains, e.g. day change and P&L. */
export function formatSignedINR(value: number, decimals = 2): string {
  const prefix = signOf(value, decimals) === 1 ? "+" : ""
  return `${prefix}${formatINR(value, decimals)}`
}

/** Short form for tiles and summaries: ₹12,340 · ₹24.6L · ₹1.25Cr */
export function formatCompactINR(value: number): string {
  const abs = Math.abs(value)
  if (Math.round(abs) < LAKH) return formatINR(value, 0)

  const sign = value < 0 ? MINUS : ""
  // Decide the unit after rounding, so 99.999L shows as ₹1Cr rather than ₹100L.
  const lakhs = Number((abs / LAKH).toFixed(2))
  if (lakhs < 100) return `${sign}₹${trimZeros(lakhs.toFixed(2))}L`
  return `${sign}₹${trimZeros((abs / CRORE).toFixed(2))}Cr`
}

export function formatPercent(
  value: number,
  { decimals = 2, signed = true }: { decimals?: number; signed?: boolean } = {},
): string {
  const sign = signOf(value, decimals)
  const prefix = sign === -1 ? MINUS : sign === 1 && signed ? "+" : ""
  return `${prefix}${Math.abs(value).toFixed(decimals)}%`
}

export function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value))
}
