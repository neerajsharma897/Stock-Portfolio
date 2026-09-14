// Mutual fund holdings: units per platform account and fund, valued at the
// latest AMFI NAV, with XIRR from the dated purchases and redemptions.

import {
  buildPosition,
  sortTransactions,
  type Position,
  type PositionTransaction,
} from "@/lib/portfolio/holdings"
import { xirr, type CashFlow } from "@/lib/portfolio/xirr"

/** XIRR over a few months swings wildly, so it's shown only after a year. */
export const MIN_XIRR_DAYS = 365
const DAY_MS = 86_400_000

export type FundTransactionForHolding = PositionTransaction & {
  brokerAccountId: string
  amfiCode: number
}

export type FundHolding = {
  brokerAccountId: string
  amfiCode: number
  position: Position
  /** Money put in (negative) and taken out (positive), one per entry. */
  flows: CashFlow[]
}

/** A fund whose saved entries don't add up, e.g. redeeming more units than held. */
export type FundProblem = {
  brokerAccountId: string
  amfiCode: number
  transactionId: string
  message: string
}

export type FundNav = {
  nav: number
  /** YYYY-MM-DD */
  navDate: string
  previousNav: number | null
}

export type ValuedFund = FundHolding & {
  price: {
    lastPrice: number
    previousClose: number | null
    pricedAt: string
  } | null
  /** Null for redeemed funds and funds without a NAV. */
  currentValue: number | null
  unrealizedPnl: number | null
  unrealizedPct: number | null
  /** Change on the latest NAV date; null without a previous NAV. */
  dayChange: number | null
  dayChangePct: number | null
  /** Yearly return as a fraction (0.12 = 12%); null under a year or without a NAV. */
  xirr: number | null
}

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

/** Groups a member's fund entries into one holding per account and fund. */
export function groupFundHoldings(
  transactions: readonly FundTransactionForHolding[],
): { holdings: FundHolding[]; problems: FundProblem[] } {
  const groups = new Map<string, FundTransactionForHolding[]>()
  for (const transaction of transactions) {
    const key = `${transaction.brokerAccountId}:${transaction.amfiCode}`
    const group = groups.get(key)
    if (group) group.push(transaction)
    else groups.set(key, [transaction])
  }

  const holdings: FundHolding[] = []
  const problems: FundProblem[] = []
  for (const group of groups.values()) {
    const { brokerAccountId, amfiCode } = group[0]
    const result = buildPosition(group, { sellLabel: "redemption" })
    if (result.ok) {
      holdings.push({
        brokerAccountId,
        amfiCode,
        position: result.position,
        flows: sortTransactions(group).map(cashFlowOf),
      })
    } else {
      problems.push({
        brokerAccountId,
        amfiCode,
        transactionId: result.transactionId,
        message: result.message,
      })
    }
  }
  return { holdings, problems }
}

function latestDate(dates: readonly string[]): string {
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

const NOT_VALUED = {
  currentValue: null,
  unrealizedPnl: null,
  unrealizedPct: null,
  dayChange: null,
  dayChangePct: null,
}

export function valueFund(
  holding: FundHolding,
  nav: FundNav | null,
): ValuedFund {
  const { quantity, invested } = holding.position
  const price = nav
    ? {
        lastPrice: nav.nav,
        previousClose: nav.previousNav,
        pricedAt: nav.navDate,
      }
    : null

  if (quantity <= 0) {
    return {
      ...holding,
      price,
      ...NOT_VALUED,
      xirr: annualReturn(holding.flows),
    }
  }
  if (!nav) return { ...holding, price, ...NOT_VALUED, xirr: null }

  const currentValue = quantity * nav.nav
  const unrealizedPnl = currentValue - invested
  const { previousNav } = nav

  return {
    ...holding,
    price,
    currentValue,
    unrealizedPnl,
    unrealizedPct: invested > 0 ? (unrealizedPnl / invested) * 100 : null,
    dayChange: previousNav === null ? null : quantity * (nav.nav - previousNav),
    dayChangePct:
      previousNav === null
        ? null
        : ((nav.nav - previousNav) / previousNav) * 100,
    xirr: annualReturn(holding.flows, {
      date: latestDate([
        nav.navDate,
        ...holding.flows.map((flow) => flow.date),
      ]),
      amount: currentValue,
    }),
  }
}

/** XIRR across several funds, e.g. a member's or the family's. Null if any held fund has no NAV. */
export function combinedReturn(funds: readonly ValuedFund[]): number | null {
  const held = funds.filter((fund) => fund.position.quantity > 0)
  if (held.some((fund) => fund.currentValue === null)) return null

  const flows = funds.flatMap((fund) => fund.flows)
  if (flows.length === 0) return null
  const value = held.reduce((sum, fund) => sum + (fund.currentValue ?? 0), 0)
  const date = latestDate([
    ...flows.map((flow) => flow.date),
    ...held.flatMap((fund) => (fund.price ? [fund.price.pricedAt] : [])),
  ])
  return annualReturn(flows, { date, amount: value })
}

/**
 * Funds for family and member totals next to stocks. A NAV change is for the
 * previous business day, not today, so it's left out of "today".
 */
export function forFamilyTotals(funds: readonly ValuedFund[]) {
  return funds.map((fund) => ({ ...fund, dayChange: null }))
}
