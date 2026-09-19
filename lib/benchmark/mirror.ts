// "What if the same money had gone into the Nifty 50?" Every rupee put into
// stocks buys index units at that day's close, and every rupee taken out sells
// units, so the index gets exactly the same cash flows on the same dates.

import { annualReturn } from "@/lib/portfolio/returns"
import type { CashFlow } from "@/lib/portfolio/xirr"

/** One trading day's close, oldest first. */
export type DailyClose = { date: string; close: number }

/** The close on the date, or the last one before it; the first close for earlier dates. */
export function closeOn(
  closes: readonly DailyClose[],
  date: string,
): number | null {
  if (closes.length === 0) return null
  let low = 0
  let high = closes.length - 1
  if (date < closes[0].date) return closes[0].close
  // Binary search for the last close on or before the date.
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (closes[middle].date <= date) low = middle
    else high = middle - 1
  }
  return closes[low].close
}

export type Mirror = {
  /** Put in minus taken out. */
  netInvested: number
  /** What the index units are worth at the latest close. */
  value: number
  /** Value plus money taken out, minus money put in. */
  gain: number
  /** Yearly return; null under a year. */
  xirr: number | null
  /** Date of the close used for the value. */
  valuedOn: string
}

export function mirrorIndex(
  flows: readonly CashFlow[],
  closes: readonly DailyClose[],
): Mirror | null {
  const latest = closes[closes.length - 1]
  if (!latest || flows.length === 0) return null

  let units = 0
  for (const flow of flows) {
    const close = closeOn(closes, flow.date)
    if (!close) return null
    // Money in (negative) buys units; money out sells them.
    units -= flow.amount / close
  }
  const value = units * latest.close
  const flowTotal = flows.reduce((sum, flow) => sum + flow.amount, 0)
  return {
    netInvested: -flowTotal,
    value,
    gain: value + flowTotal,
    xirr: annualReturn(flows, { date: latest.date, amount: value }),
    valuedOn: latest.date,
  }
}
