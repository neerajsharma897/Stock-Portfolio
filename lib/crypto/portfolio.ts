// Crypto holdings: coins per exchange account, valued at CoinDCX's latest rupee
// price. Crypto trades around the clock, so its "day change" covers the last 24 hours.

import {
  buildPosition,
  type Position,
  type PositionTransaction,
} from "@/lib/portfolio/holdings"
import {
  annualReturn,
  cashFlowsOf,
  valuationDate,
} from "@/lib/portfolio/returns"
import type { CashFlow } from "@/lib/portfolio/xirr"

export type CryptoTransactionForHolding = PositionTransaction & {
  brokerAccountId: string
  market: string
}

export type CryptoHolding = {
  brokerAccountId: string
  market: string
  position: Position
  /** Money put in (negative) and taken out (positive), one per entry. */
  flows: CashFlow[]
}

/** A coin whose saved entries don't add up, e.g. a sell larger than the coins held. */
export type CryptoProblem = {
  brokerAccountId: string
  market: string
  transactionId: string
  message: string
}

export type CoinPrice = {
  lastPrice: number
  /** Percent; null when unknown. */
  change24hPct: number | null
  pricedAt: string
}

export type ValuedCrypto = CryptoHolding & {
  price: {
    lastPrice: number
    /** Price 24 hours ago, worked out from the 24-hour change. */
    previousClose: number | null
    pricedAt: string
  } | null
  /** Null for sold coins and coins without a price. */
  currentValue: number | null
  unrealizedPnl: number | null
  unrealizedPct: number | null
  /** Change over the last 24 hours; null without a 24-hour change. */
  dayChange: number | null
  dayChangePct: number | null
  /** Yearly return as a fraction; null under a year or without a price. */
  xirr: number | null
}

/** Groups a member's coin entries into one holding per account and coin. */
export function groupCryptoHoldings(
  transactions: readonly CryptoTransactionForHolding[],
): { holdings: CryptoHolding[]; problems: CryptoProblem[] } {
  const groups = new Map<string, CryptoTransactionForHolding[]>()
  for (const transaction of transactions) {
    const key = `${transaction.brokerAccountId}:${transaction.market}`
    const group = groups.get(key)
    if (group) group.push(transaction)
    else groups.set(key, [transaction])
  }

  const holdings: CryptoHolding[] = []
  const problems: CryptoProblem[] = []
  for (const group of groups.values()) {
    const { brokerAccountId, market } = group[0]
    const result = buildPosition(group)
    if (result.ok) {
      holdings.push({
        brokerAccountId,
        market,
        position: result.position,
        flows: cashFlowsOf(group),
      })
    } else {
      problems.push({
        brokerAccountId,
        market,
        transactionId: result.transactionId,
        message: result.message,
      })
    }
  }
  return { holdings, problems }
}

export function valueCrypto(
  holding: CryptoHolding,
  coinPrice: CoinPrice | null,
): ValuedCrypto {
  const { quantity, invested } = holding.position
  const change = coinPrice?.change24hPct ?? null
  const previousClose =
    coinPrice && change !== null && change > -100
      ? coinPrice.lastPrice / (1 + change / 100)
      : null
  const price = coinPrice
    ? {
        lastPrice: coinPrice.lastPrice,
        previousClose,
        pricedAt: coinPrice.pricedAt,
      }
    : null

  if (!coinPrice || quantity <= 0) {
    return {
      ...holding,
      price,
      currentValue: null,
      unrealizedPnl: null,
      unrealizedPct: null,
      dayChange: null,
      dayChangePct: null,
      xirr: quantity <= 0 ? annualReturn(holding.flows) : null,
    }
  }

  const currentValue = quantity * coinPrice.lastPrice
  const unrealizedPnl = currentValue - invested
  return {
    ...holding,
    price,
    currentValue,
    unrealizedPnl,
    unrealizedPct: invested > 0 ? (unrealizedPnl / invested) * 100 : null,
    dayChange:
      previousClose === null
        ? null
        : quantity * (coinPrice.lastPrice - previousClose),
    dayChangePct: previousClose === null ? null : change,
    xirr: annualReturn(holding.flows, {
      date: valuationDate(coinPrice.pricedAt),
      amount: currentValue,
    }),
  }
}

/**
 * Coins for family and member totals next to stocks. A 24-hour change isn't
 * the stock market's "today", so it's left out of "today".
 */
export function forFamilyTotals(holdings: readonly ValuedCrypto[]) {
  return holdings.map((holding) => ({ ...holding, dayChange: null }))
}
