// Values holdings with their latest price and adds them up for a member or the
// whole family. Holdings without a price are counted but left out of current
// value and P&L, so a missing price never shows up as a loss.

import type { Position } from "@/lib/portfolio/holdings"
import type { Holding } from "@/lib/portfolio/member-holdings"
import { annualReturn, valuationDate } from "@/lib/portfolio/returns"

export type Price = {
  lastPrice: number
  /** Previous trading day's close; null when unknown (no "today" figures then). */
  previousClose: number | null
  pricedAt: string
  source: "manual" | "angelone"
}

export type ValuedHolding = Holding & {
  price: Price | null
  /** Null for closed positions and holdings without a price. */
  currentValue: number | null
  unrealizedPnl: number | null
  unrealizedPct: number | null
  /** Null without a previous close. */
  dayChange: number | null
  dayChangePct: number | null
  /** Yearly return as a fraction (0.12 = 12%); null under a year or without a price. */
  xirr: number | null
}

export type PortfolioSummary = {
  /** Open holdings (quantity above zero). */
  holdingCount: number
  pricedCount: number
  /** Cost of all open holdings, priced or not. */
  invested: number
  /** Cost of the open holdings that have a price. */
  pricedInvested: number
  currentValue: number
  unrealizedPnl: number
  unrealizedPct: number | null
  dayChange: number
  dayChangePct: number | null
  /** Booked by sells, including fully sold positions. */
  realizedPnl: number
  latestPricedAt: string | null
}

export type Mover = {
  instrumentId: number
  lastPrice: number
  changePct: number
  /** Family-wide rupee change for this stock today. */
  dayChange: number
}

/** One row of the "Update prices" form. */
export type PriceItem = {
  instrumentId: number
  symbol: string
  exchange: string
  lastPrice: number | null
  previousClose: number | null
  pricedAt: string | null
}

function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null
}

export function valueHolding(
  holding: Holding,
  price: Price | null,
): ValuedHolding {
  const { quantity, invested } = holding.position
  if (!price || quantity <= 0) {
    return {
      ...holding,
      price,
      currentValue: null,
      unrealizedPnl: null,
      unrealizedPct: null,
      dayChange: null,
      dayChangePct: null,
      // A sold-out holding's return comes from its entries alone.
      xirr: quantity <= 0 ? annualReturn(holding.flows) : null,
    }
  }

  const currentValue = quantity * price.lastPrice
  const unrealizedPnl = currentValue - invested
  const { previousClose } = price

  return {
    ...holding,
    price,
    currentValue,
    unrealizedPnl,
    unrealizedPct: percentOf(unrealizedPnl, invested),
    dayChange:
      previousClose === null
        ? null
        : quantity * (price.lastPrice - previousClose),
    dayChangePct:
      previousClose === null
        ? null
        : percentOf(price.lastPrice - previousClose, previousClose),
    xirr: annualReturn(holding.flows, {
      date: valuationDate(price.pricedAt),
      amount: currentValue,
    }),
  }
}

/** What summarize needs. Stock and mutual fund holdings both fit. */
export type SummaryInput = {
  position: Pick<Position, "quantity" | "invested" | "realizedPnl">
  price: { pricedAt: string } | null
  currentValue: number | null
  unrealizedPnl: number | null
  dayChange: number | null
}

export function summarize(holdings: readonly SummaryInput[]): PortfolioSummary {
  let holdingCount = 0
  let pricedCount = 0
  let invested = 0
  let pricedInvested = 0
  let currentValue = 0
  let unrealizedPnl = 0
  let dayChange = 0
  let previousValue = 0
  let realizedPnl = 0
  let latestPricedAt: string | null = null

  for (const holding of holdings) {
    realizedPnl += holding.position.realizedPnl
    if (holding.position.quantity <= 0) continue

    holdingCount += 1
    invested += holding.position.invested
    if (holding.currentValue === null || !holding.price) continue

    pricedCount += 1
    pricedInvested += holding.position.invested
    currentValue += holding.currentValue
    unrealizedPnl += holding.unrealizedPnl ?? 0
    if (!latestPricedAt || holding.price.pricedAt > latestPricedAt) {
      latestPricedAt = holding.price.pricedAt
    }
    if (holding.dayChange !== null) {
      dayChange += holding.dayChange
      previousValue += holding.currentValue - holding.dayChange
    }
  }

  return {
    holdingCount,
    pricedCount,
    invested,
    pricedInvested,
    currentValue,
    unrealizedPnl,
    unrealizedPct: percentOf(unrealizedPnl, pricedInvested),
    dayChange,
    dayChangePct: percentOf(dayChange, previousValue),
    realizedPnl,
    latestPricedAt,
  }
}

/** Biggest risers and fallers today; each stock once, even if several members hold it. */
export function topMovers(
  holdings: readonly ValuedHolding[],
  limit = 3,
): { gainers: Mover[]; losers: Mover[] } {
  const byInstrument = new Map<number, Mover>()
  for (const holding of holdings) {
    if (
      holding.position.quantity <= 0 ||
      !holding.price ||
      holding.dayChange === null ||
      holding.dayChangePct === null
    ) {
      continue
    }
    const existing = byInstrument.get(holding.instrumentId)
    if (existing) {
      existing.dayChange += holding.dayChange
    } else {
      byInstrument.set(holding.instrumentId, {
        instrumentId: holding.instrumentId,
        lastPrice: holding.price.lastPrice,
        changePct: holding.dayChangePct,
        dayChange: holding.dayChange,
      })
    }
  }

  const movers = [...byInstrument.values()]
  return {
    gainers: movers
      .filter((mover) => mover.changePct > 0)
      .sort((a, b) => b.changePct - a.changePct)
      .slice(0, limit),
    losers: movers
      .filter((mover) => mover.changePct < 0)
      .sort((a, b) => a.changePct - b.changePct)
      .slice(0, limit),
  }
}

/** One price row per stock currently held, sorted by symbol. */
export function buildPriceItems(
  holdings: readonly ValuedHolding[],
  instruments: ReadonlyMap<number, { symbol: string; exchange: string }>,
): PriceItem[] {
  const items = new Map<number, PriceItem>()
  for (const holding of holdings) {
    if (holding.position.quantity <= 0 || items.has(holding.instrumentId)) {
      continue
    }
    const instrument = instruments.get(holding.instrumentId)
    if (!instrument) continue
    items.set(holding.instrumentId, {
      instrumentId: holding.instrumentId,
      symbol: instrument.symbol,
      exchange: instrument.exchange,
      lastPrice: holding.price?.lastPrice ?? null,
      previousClose: holding.price?.previousClose ?? null,
      pricedAt: holding.price?.pricedAt ?? null,
    })
  }
  return [...items.values()].sort(
    (a, b) =>
      a.symbol.localeCompare(b.symbol) || a.exchange.localeCompare(b.exchange),
  )
}
