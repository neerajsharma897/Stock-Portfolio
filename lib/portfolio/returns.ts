// Yearly returns (XIRR) from dated cash flows: money put in is negative, money
// taken out (and what's still held, on the valuation date) is positive.

import { todayInIndia } from "@/lib/dates"
import {
  sortTransactions,
  type PositionTransaction,
} from "@/lib/portfolio/holdings"
import { xirr, type CashFlow } from "@/lib/portfolio/xirr"

/** XIRR over a few months swings wildly, so it's shown only after a year. */
export const MIN_XIRR_DAYS = 365
const DAY_MS = 86_400_000

export function cashFlowOf(transaction: PositionTransaction): CashFlow {
  const gross = transaction.quantity * transaction.price
  return {
    date: transaction.tradeDate,
    amount:
      transaction.type === "sell"
        ? gross - transaction.charges
        : -(gross + transaction.charges),
  }
}

/** One cash flow per entry, oldest first. */
export function cashFlowsOf(
  transactions: readonly PositionTransaction[],
): CashFlow[] {
  return sortTransactions(transactions).map(cashFlowOf)
}

/** The India date of a price time or NAV date, e.g. "2026-09-19". */
export function valuationDate(pricedAt: string): string {
  return todayInIndia(new Date(pricedAt))
}

export function latestDate(dates: readonly string[]): string {
  return dates.reduce((latest, date) => (date > latest ? date : latest))
}

function daysBetween(from: string, to: string) {
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS
  )
}

/**
 * XIRR of the entries plus what's still held (a positive flow on the valuation
 * date). Null when the money has been invested for less than a year.
 */
export function annualReturn(
  flows: readonly CashFlow[],
  held?: CashFlow,
): number | null {
  const all = held && held.amount > 0 ? [...flows, held] : [...flows]
  if (all.length < 2) return null
  const dates = all.map((flow) => flow.date).sort()
  if (daysBetween(dates[0], dates[dates.length - 1]) < MIN_XIRR_DAYS) {
    return null
  }
  return xirr(all)
}

export type ReturnPart = {
  flows: readonly CashFlow[]
  /** Still held, so its current value counts. */
  held: boolean
  currentValue: number | null
  /** Price time or date the value is from. */
  valuedOn: string | null
}

/** XIRR across several holdings, e.g. a member's or the family's. Null if any held one has no value. */
export function combinedAnnualReturn(
  parts: readonly ReturnPart[],
): number | null {
  const held = parts.filter((part) => part.held)
  if (held.some((part) => part.currentValue === null)) return null

  const flows = parts.flatMap((part) => part.flows)
  if (flows.length === 0) return null
  const value = held.reduce((sum, part) => sum + (part.currentValue ?? 0), 0)
  const date = latestDate([
    ...flows.map((flow) => flow.date),
    ...held.flatMap((part) =>
      part.valuedOn ? [valuationDate(part.valuedOn)] : [],
    ),
  ])
  return annualReturn(flows, { date, amount: value })
}
