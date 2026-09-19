// Chart ranges and Angel One historical candles. Candles are fetched when a chart
// opens and kept briefly in server memory; nothing is stored in the database.

export const CHART_RANGES = ["1D", "1W", "1M", "6M", "1Y", "5Y"] as const
export type ChartRange = (typeof CHART_RANGES)[number]

export type CandleInterval =
  "FIVE_MINUTE" | "FIFTEEN_MINUTE" | "ONE_HOUR" | "ONE_DAY"

/** One bar; `time` is Unix seconds. */
export type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
}

type RangeSpec = { interval: CandleInterval; days: number; intraday: boolean }

// Well inside SmartAPI's per-request limits (100 days of 5-minute candles,
// 200 of 15-minute, 400 of hourly and 2,000 of daily).
export const RANGE_SPECS: Record<ChartRange, RangeSpec> = {
  // A week back, so weekends and holidays still show the last session.
  "1D": { interval: "FIVE_MINUTE", days: 7, intraday: true },
  "1W": { interval: "FIFTEEN_MINUTE", days: 7, intraday: true },
  "1M": { interval: "ONE_HOUR", days: 31, intraday: true },
  "6M": { interval: "ONE_DAY", days: 183, intraday: false },
  "1Y": { interval: "ONE_DAY", days: 366, intraday: false },
  "5Y": { interval: "ONE_DAY", days: 1826, intraday: false },
}

export function isChartRange(value: unknown): value is ChartRange {
  return CHART_RANGES.includes(value as ChartRange)
}

const DAY_MS = 86_400_000
const FIVE_MINUTES_S = 300

const indiaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const indiaTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** SmartAPI's fromdate and todate ("yyyy-MM-dd HH:mm", India time) for a range ending now. */
export function candleRequestDates(range: ChartRange, now: Date) {
  const from = new Date(now.getTime() - RANGE_SPECS[range].days * DAY_MS)
  return {
    fromdate: `${indiaDate.format(from)} 00:00`,
    todate: `${indiaDate.format(now)} ${indiaTime.format(now)}`,
  }
}

function positive(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

/** Reads SmartAPI rows of [timestamp, open, high, low, close, volume], oldest first. */
export function parseCandles(data: unknown): Candle[] {
  if (!Array.isArray(data)) return []
  const candles = new Map<number, Candle>()
  for (const row of data) {
    if (!Array.isArray(row) || typeof row[0] !== "string") continue
    const millis = Date.parse(row[0])
    const [open, high, low, close] = row.slice(1, 5).map(positive)
    if (Number.isNaN(millis) || !open || !high || !low || !close) continue
    const time = Math.floor(millis / 1000)
    candles.set(time, { time, open, high, low, close })
  }
  return [...candles.values()].sort((a, b) => a.time - b.time)
}

/** Only the candles from the latest trading day (India date) in the list. */
export function lastSession(candles: readonly Candle[]): Candle[] {
  if (candles.length === 0) return []
  const day = indiaDate.format(new Date(candles.at(-1)!.time * 1000))
  return candles.filter(
    (candle) => indiaDate.format(new Date(candle.time * 1000)) === day,
  )
}

/** Start of the 5-minute candle a live price falls in, in Unix seconds. */
export function liveBucket(pricedAt: string): number {
  const seconds = Math.floor(Date.parse(pricedAt) / 1000)
  return seconds - (seconds % FIVE_MINUTES_S)
}

/**
 * Latest price and its change over the chart's range. A day's change is from
 * the previous close when known; longer ranges start from the first candle.
 */
export function rangeChange(
  candles: readonly Candle[],
  range: ChartRange,
  previousClose: number | null,
  lastPrice?: number,
): { last: number; change: number; changePct: number } | null {
  if (candles.length === 0) return null
  const last = lastPrice ?? candles.at(-1)!.close
  const base = range === "1D" && previousClose ? previousClose : candles[0].open
  return { last, change: last - base, changePct: ((last - base) / base) * 100 }
}
