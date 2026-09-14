import { describe, expect, it } from "vitest"

import type { Holding } from "@/lib/portfolio/member-holdings"
import {
  buildPriceItems,
  summarize,
  topMovers,
  valueHolding,
  type Price,
} from "@/lib/portfolio/valuation"

function holding(
  quantity: number,
  invested: number,
  { realizedPnl = 0, instrumentId = 1, brokerAccountId = "acc" } = {},
): Holding {
  return {
    brokerAccountId,
    instrumentId,
    position: {
      quantity,
      invested,
      averageCost: quantity > 0 ? invested / quantity : 0,
      realizedPnl,
      lots: [],
    },
  }
}

function price(
  lastPrice: number,
  previousClose: number | null = null,
  pricedAt = "2026-09-14T10:00:00Z",
): Price {
  return { lastPrice, previousClose, pricedAt, source: "manual" }
}

describe("valueHolding", () => {
  it("values a priced holding and today's change", () => {
    const valued = valueHolding(holding(10, 1000), price(120, 110))
    expect(valued.currentValue).toBe(1200)
    expect(valued.unrealizedPnl).toBe(200)
    expect(valued.unrealizedPct).toBe(20)
    expect(valued.dayChange).toBe(100)
    expect(valued.dayChangePct).toBeCloseTo(9.0909, 3)
  })

  it("leaves today's change empty without a previous close", () => {
    const valued = valueHolding(holding(10, 1000), price(90))
    expect(valued.unrealizedPnl).toBe(-100)
    expect(valued.dayChange).toBeNull()
    expect(valued.dayChangePct).toBeNull()
  })

  it("has no value without a price or for a closed position", () => {
    expect(valueHolding(holding(10, 1000), null).currentValue).toBeNull()
    expect(valueHolding(holding(0, 0), price(100)).currentValue).toBeNull()
  })
})

describe("summarize", () => {
  it("counts unpriced holdings in invested but not in value or P&L", () => {
    const summary = summarize([
      valueHolding(holding(10, 1000), price(120, 110)),
      valueHolding(holding(5, 500, { instrumentId: 2 }), null),
      valueHolding(holding(0, 0, { instrumentId: 3, realizedPnl: 50 }), null),
    ])
    expect(summary).toMatchObject({
      holdingCount: 2,
      pricedCount: 1,
      invested: 1500,
      pricedInvested: 1000,
      currentValue: 1200,
      unrealizedPnl: 200,
      unrealizedPct: 20,
      dayChange: 100,
      realizedPnl: 50,
      latestPricedAt: "2026-09-14T10:00:00Z",
    })
    // Today's change is measured against yesterday's value (1,200 − 100).
    expect(summary.dayChangePct).toBeCloseTo((100 / 1100) * 100, 6)
  })

  it("returns zeros and no percentages for an empty portfolio", () => {
    expect(summarize([])).toEqual({
      holdingCount: 0,
      pricedCount: 0,
      invested: 0,
      pricedInvested: 0,
      currentValue: 0,
      unrealizedPnl: 0,
      unrealizedPct: null,
      dayChange: 0,
      dayChangePct: null,
      realizedPnl: 0,
      latestPricedAt: null,
    })
  })
})

describe("topMovers", () => {
  it("lists each stock once and splits gainers from losers", () => {
    const up = price(110, 100)
    const down = price(95, 100)
    const { gainers, losers } = topMovers([
      valueHolding(
        holding(10, 900, { instrumentId: 1, brokerAccountId: "dad" }),
        up,
      ),
      valueHolding(
        holding(5, 450, { instrumentId: 1, brokerAccountId: "mom" }),
        up,
      ),
      valueHolding(holding(4, 400, { instrumentId: 2 }), down),
      valueHolding(holding(4, 400, { instrumentId: 3 }), price(100)),
    ])
    expect(gainers).toEqual([
      { instrumentId: 1, lastPrice: 110, changePct: 10, dayChange: 150 },
    ])
    expect(losers).toEqual([
      { instrumentId: 2, lastPrice: 95, changePct: -5, dayChange: -20 },
    ])
  })
})

describe("buildPriceItems", () => {
  it("lists held stocks once, sorted by symbol, skipping sold-out ones", () => {
    const instruments = new Map([
      [1, { symbol: "TCS", exchange: "NSE" }],
      [2, { symbol: "INFY", exchange: "NSE" }],
      [3, { symbol: "ITC", exchange: "NSE" }],
    ])
    const items = buildPriceItems(
      [
        valueHolding(holding(10, 1000, { instrumentId: 1 }), price(120, 110)),
        valueHolding(
          holding(3, 300, { instrumentId: 1, brokerAccountId: "b" }),
          price(120, 110),
        ),
        valueHolding(holding(2, 200, { instrumentId: 2 }), null),
        valueHolding(holding(0, 0, { instrumentId: 3 }), null),
      ],
      instruments,
    )
    expect(items).toEqual([
      {
        instrumentId: 2,
        symbol: "INFY",
        exchange: "NSE",
        lastPrice: null,
        previousClose: null,
        pricedAt: null,
      },
      {
        instrumentId: 1,
        symbol: "TCS",
        exchange: "NSE",
        lastPrice: 120,
        previousClose: 110,
        pricedAt: "2026-09-14T10:00:00Z",
      },
    ])
  })
})
