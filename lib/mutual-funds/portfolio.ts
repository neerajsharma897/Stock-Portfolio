// Mutual fund holdings: units per platform account and fund, valued at the
// latest AMFI NAV, with XIRR from the dated purchases and redemptions.

import {
  buildPosition,
  type Position,
  type PositionTransaction,
} from "@/lib/portfolio/holdings"
import {
  annualReturn,
  cashFlowsOf,
  combinedAnnualReturn,
  latestDate,
} from "@/lib/portfolio/returns"
import type { CashFlow } from "@/lib/portfolio/xirr"

export {
  annualReturn,
  cashFlowOf,
  MIN_XIRR_DAYS,
} from "@/lib/portfolio/returns"

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
        flows: cashFlowsOf(group),
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
  return combinedAnnualReturn(
    funds.map((fund) => ({
      flows: fund.flows,
      held: fund.position.quantity > 0,
      currentValue: fund.currentValue,
      valuedOn: fund.price?.pricedAt ?? null,
    })),
  )
}

/**
 * Funds for family and member totals next to stocks. A NAV change is for the
 * previous business day, not today, so it's left out of "today".
 */
export function forFamilyTotals(funds: readonly ValuedFund[]) {
  return funds.map((fund) => ({ ...fund, dayChange: null }))
}
