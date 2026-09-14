import { todayInIndia } from "@/lib/dates"

// NSE and BSE regular session in India time: 09:15 to 15:30, Monday to Friday.
const OPEN_MINUTE = 9 * 60 + 15
const CLOSE_MINUTE = 15 * 60 + 30

export type MarketStatus = {
  open: boolean
  /** Today's date in India, YYYY-MM-DD. */
  date: string
  reason: "open" | "weekend" | "holiday" | "before_open" | "after_close"
  holiday: string | null
}

const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kolkata",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** Whether the stock market is in its regular session at `now`. */
export function getMarketStatus(
  now: Date,
  holidays: ReadonlyMap<string, string> = new Map(),
): MarketStatus {
  const parts = Object.fromEntries(
    clockFormatter.formatToParts(now).map((part) => [part.type, part.value]),
  )
  const date = todayInIndia(now)
  const closed = (
    reason: MarketStatus["reason"],
    holiday: string | null = null,
  ) => ({ open: false, date, reason, holiday }) as const

  if (parts.weekday === "Sat" || parts.weekday === "Sun")
    return closed("weekend")

  const holiday = holidays.get(date)
  if (holiday) return closed("holiday", holiday)

  const minute = Number(parts.hour) * 60 + Number(parts.minute)
  if (minute < OPEN_MINUTE) return closed("before_open")
  if (minute >= CLOSE_MINUTE) return closed("after_close")
  return { open: true, date, reason: "open", holiday: null }
}
