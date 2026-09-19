// Fixed deposits and hand-valued assets (gold, PPF, property, ...) for member
// and family totals. FD values are estimates: banks compound at period ends, and
// this spreads interest smoothly over the days held.

import type { FdInterest } from "@/lib/other-assets/options"
import type { SummaryInput } from "@/lib/portfolio/valuation"

const PERIODS_PER_YEAR: Record<Exclude<FdInterest, "payout">, number> = {
  monthly: 12,
  quarterly: 4,
  half_yearly: 2,
  yearly: 1,
}
const DAY_MS = 86_400_000

export type DepositTerms = {
  principal: number
  /** Yearly rate in percent, e.g. 7.1. */
  ratePct: number
  interest: FdInterest
  /** YYYY-MM-DD */
  startDate: string
  maturityDate: string
  closedOn: string | null
}

function yearsBetween(from: string, to: string) {
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    DAY_MS /
    365
  )
}

/** What the FD is worth on `date`; interest stops at maturity. Payout FDs stay at the principal. */
export function depositValueOn(deposit: DepositTerms, date: string): number {
  if (deposit.interest === "payout" || date <= deposit.startDate) {
    return deposit.principal
  }
  const end = date < deposit.maturityDate ? date : deposit.maturityDate
  const periods = PERIODS_PER_YEAR[deposit.interest]
  return (
    deposit.principal *
    (1 + deposit.ratePct / 100 / periods) **
      (periods * yearsBetween(deposit.startDate, end))
  )
}

export type ValuedDeposit<T extends DepositTerms = DepositTerms> = T & {
  value: number
  maturityValue: number
  matured: boolean
  closed: boolean
}

export function valueDeposit<T extends DepositTerms>(
  deposit: T,
  asOf: string,
): ValuedDeposit<T> {
  return {
    ...deposit,
    value: depositValueOn(deposit, asOf),
    maturityValue: depositValueOn(deposit, deposit.maturityDate),
    matured: asOf >= deposit.maturityDate,
    closed: deposit.closedOn !== null && deposit.closedOn <= asOf,
  }
}

/** A running FD in the totals; closed FDs have been paid out, so they drop out. */
export function depositForTotals(
  deposit: ValuedDeposit,
  asOf: string,
): SummaryInput {
  return {
    position: {
      quantity: deposit.closed ? 0 : 1,
      invested: deposit.principal,
      realizedPnl: 0,
    },
    price: { pricedAt: asOf },
    currentValue: deposit.value,
    unrealizedPnl: deposit.value - deposit.principal,
    dayChange: null,
  }
}

export type AssetValue = {
  invested: number
  currentValue: number
  /** YYYY-MM-DD */
  valueAsOf: string
}

export function otherAssetForTotals(asset: AssetValue): SummaryInput {
  return {
    position: { quantity: 1, invested: asset.invested, realizedPnl: 0 },
    price: { pricedAt: asset.valueAsOf },
    currentValue: asset.currentValue,
    unrealizedPnl: asset.currentValue - asset.invested,
    dayChange: null,
  }
}
