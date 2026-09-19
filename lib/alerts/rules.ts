// Price alert rules and the Telegram messages they send. Pure functions: the
// alerts job and the live price refresh do the fetching and sending.

import { todayInIndia } from "@/lib/dates"
import { formatINR, formatPercent, formatQuantity } from "@/lib/format"
import type { Enums } from "@/lib/supabase/database.types"
import { escapeHtml } from "@/lib/telegram/format"

export type AlertKind = Enums<"alert_kind">

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  price_above: "Price goes above",
  price_below: "Price falls below (stop-loss)",
  day_move: "Moves a lot in a day",
  high_52w: "New 52-week high",
  low_52w: "New 52-week low",
}
export const ALERT_KINDS = Object.keys(ALERT_KIND_LABELS) as [
  AlertKind,
  ...AlertKind[],
]

/** What the threshold means for each kind, or null when there isn't one. */
export const THRESHOLD_UNIT: Record<AlertKind, "rupees" | "percent" | null> = {
  price_above: "rupees",
  price_below: "rupees",
  day_move: "percent",
  high_52w: null,
  low_52w: null,
}

export type RuleForCheck = {
  kind: AlertKind
  threshold: number | null
  lastTriggeredAt: string | null
}

export type QuoteForCheck = {
  lastPrice: number
  previousClose: number | null
  week52High: number | null
  week52Low: number | null
}

/** "Above ₹4,200", "Moves 4% in a day", "New 52-week high". */
export function describeRule(rule: Pick<RuleForCheck, "kind" | "threshold">) {
  switch (rule.kind) {
    case "price_above":
      return `Above ${formatINR(rule.threshold ?? 0)}`
    case "price_below":
      return `Below ${formatINR(rule.threshold ?? 0)}`
    case "day_move":
      return `Moves ${formatPercent(rule.threshold ?? 0, { signed: false })} in a day`
    case "high_52w":
      return "New 52-week high"
    case "low_52w":
      return "New 52-week low"
  }
}

export function dayChangePct(quote: QuoteForCheck): number | null {
  return quote.previousClose
    ? ((quote.lastPrice - quote.previousClose) / quote.previousClose) * 100
    : null
}

/** Whether the quote meets the rule, ignoring the once-a-day limit. */
export function ruleMet(rule: RuleForCheck, quote: QuoteForCheck): boolean {
  switch (rule.kind) {
    case "price_above":
      return rule.threshold !== null && quote.lastPrice >= rule.threshold
    case "price_below":
      return rule.threshold !== null && quote.lastPrice <= rule.threshold
    case "day_move": {
      const change = dayChangePct(quote)
      return (
        rule.threshold !== null &&
        change !== null &&
        Math.abs(change) >= rule.threshold
      )
    }
    case "high_52w":
      return quote.week52High !== null && quote.lastPrice >= quote.week52High
    case "low_52w":
      return quote.week52Low !== null && quote.lastPrice <= quote.week52Low
  }
}

/** Each rule fires at most once per day (India date). */
export function firedToday(lastTriggeredAt: string | null, now: Date): boolean {
  return (
    lastTriggeredAt !== null &&
    todayInIndia(new Date(lastTriggeredAt)) === todayInIndia(now)
  )
}

export type Holder = { name: string; quantity: number }

/** The Telegram message (HTML) for a rule that fired. */
export function priceAlertMessage({
  rule,
  symbol,
  quote,
  holders,
  note,
}: {
  rule: Pick<RuleForCheck, "kind" | "threshold">
  symbol: string
  quote: QuoteForCheck
  holders: readonly Holder[]
  note: string | null
}): string {
  const name = `<b>${escapeHtml(symbol)}</b>`
  const price = formatINR(quote.lastPrice)
  const change = dayChangePct(quote)
  const lines: string[] = []

  switch (rule.kind) {
    case "price_above":
      lines.push(
        `🎯 ${name} is at ${price}, above your ${formatINR(rule.threshold ?? 0)} target.`,
      )
      break
    case "price_below":
      lines.push(
        `🔻 ${name} fell to ${price}, below your ${formatINR(rule.threshold ?? 0)} stop-loss.`,
      )
      break
    case "day_move":
      lines.push(
        `⚡ ${name} is ${change === null ? "moving" : formatPercent(change)} today, at ${price}.`,
      )
      break
    case "high_52w":
      lines.push(`📈 ${name} is at a 52-week high: ${price}.`)
      break
    case "low_52w":
      lines.push(`📉 ${name} is at a 52-week low: ${price}.`)
      break
  }

  if (holders.length > 0) {
    const held = holders
      .map(
        (holder) =>
          `${escapeHtml(holder.name)} ${formatQuantity(holder.quantity)}`,
      )
      .join(", ")
    const value = holders.reduce(
      (sum, holder) => sum + holder.quantity * quote.lastPrice,
      0,
    )
    lines.push(`Held by ${held} (${formatINR(value, 0)}).`)
  }
  if (note) lines.push(`Note: ${escapeHtml(note)}`)
  return lines.join("\n")
}

/** True during quiet hours (India time). Times are "HH:MM"; equal times mean none. */
export function isQuietHours(now: Date, start: string, end: string): boolean {
  const minutes = (time: string) => {
    const [hours, mins] = time.split(":").map(Number)
    return hours * 60 + mins
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now)
  const current = minutes(parts)
  const from = minutes(start)
  const to = minutes(end)
  if (from === to) return false
  return from < to
    ? current >= from && current < to
    : current >= from || current < to
}
