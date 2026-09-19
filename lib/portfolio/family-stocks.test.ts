import { describe, expect, it } from "vitest"

import { familyStocks } from "@/lib/portfolio/family-stocks"
import type { Holding } from "@/lib/portfolio/member-holdings"
import { valueHolding, type Price } from "@/lib/portfolio/valuation"

function holding(
  instrumentId: number,
  quantity: number,
  invested: number,
  brokerAccountId = "acc",
): Holding {
  return {
    brokerAccountId,
    instrumentId,
    position: {
      quantity,
      invested,
      averageCost: quantity > 0 ? invested / quantity : 0,
      realizedPnl: 0,
      lots: [],
      sales: [],
    },
    flows: [],
  }
}

function price(lastPrice: number, previousClose: number | null = null): Price {
  return {
    lastPrice,
    previousClose,
    pricedAt: "2026-09-14T10:00:00Z",
    source: "manual",
  }
}

describe("familyStocks", () => {
  it("combines members and accounts holding the same stock", () => {
    const tcs = price(120, 100)
    const [stock] = familyStocks([
      {
        member: { id: "dad" },
        holdings: [
          valueHolding(holding(1, 10, 1000, "zerodha"), tcs),
          valueHolding(holding(1, 5, 400, "groww"), tcs),
        ],
      },
      {
        member: { id: "mom" },
        holdings: [valueHolding(holding(1, 20, 2200), tcs)],
      },
    ])

    expect(stock.quantity).toBe(35)
    expect(stock.invested).toBe(3600)
    expect(stock.averageCost).toBeCloseTo(102.857, 3)
    expect(stock.currentValue).toBe(4200)
    expect(stock.unrealizedPnl).toBe(600)
    expect(stock.dayChange).toBe(700)
    expect(stock.dayChangePct).toBe(20)
    expect(stock.weightPct).toBe(100)
    expect(stock.holders).toEqual([
      { memberId: "mom", quantity: 20, currentValue: 2400 },
      { memberId: "dad", quantity: 15, currentValue: 1800 },
    ])
  })

  it("skips sold-out positions and puts unpriced stocks last", () => {
    const stocks = familyStocks([
      {
        member: { id: "dad" },
        holdings: [
          valueHolding(holding(1, 10, 1000), price(100)),
          valueHolding(holding(2, 0, 0), price(50)),
          valueHolding(holding(3, 4, 800), null),
          valueHolding(holding(4, 30, 900), price(100)),
        ],
      },
    ])

    expect(stocks.map((stock) => stock.instrumentId)).toEqual([4, 1, 3])
    expect(stocks[0].weightPct).toBe(75)
    expect(stocks[2].currentValue).toBeNull()
    expect(stocks[2].weightPct).toBeNull()
    expect(stocks[2].holders[0].currentValue).toBeNull()
  })
})
