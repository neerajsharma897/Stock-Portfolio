import { describe, expect, it } from "vitest"

import { familyStocks } from "@/lib/portfolio/family-stocks"
import type { Lot } from "@/lib/portfolio/holdings"
import {
  concentration,
  groupStocks,
  holdingTerms,
  longTermUnrealized,
  monthlyFlows,
  UNCLASSIFIED,
} from "@/lib/portfolio/insights"
import type { Holding } from "@/lib/portfolio/member-holdings"
import { valueHolding, type Price } from "@/lib/portfolio/valuation"
import { longTermOn } from "@/lib/tax/capital-gains"

function lot(
  date: string,
  quantity: number,
  costPerShare: number,
  source: Lot["source"] = "buy",
): Lot {
  return { transactionId: date, date, quantity, costPerShare, source }
}

function holding(instrumentId: number, lots: Lot[]): Holding {
  const quantity = lots.reduce((sum, l) => sum + l.quantity, 0)
  const invested = lots.reduce((sum, l) => sum + l.quantity * l.costPerShare, 0)
  return {
    brokerAccountId: "acc",
    instrumentId,
    position: {
      quantity,
      invested,
      averageCost: quantity > 0 ? invested / quantity : 0,
      realizedPnl: 0,
      lots,
      sales: [],
    },
    flows: [],
  }
}

function price(lastPrice: number): Price {
  return {
    lastPrice,
    previousClose: null,
    pricedAt: "2026-09-19T10:00:00Z",
    source: "manual",
  }
}

describe("longTermOn", () => {
  it("is the day after the anniversary", () => {
    expect(longTermOn("2025-09-19", 12)).toBe("2026-09-20")
    expect(longTermOn("2025-01-31", 12)).toBe("2026-02-01")
  })

  it("handles month ends and leap days", () => {
    expect(longTermOn("2024-02-29", 12)).toBe("2025-03-01")
    expect(longTermOn("2025-08-31", 6)).toBe("2026-03-01")
  })
})

describe("groupStocks and concentration", () => {
  const stocks = familyStocks([
    {
      member: { id: "dad" },
      holdings: [
        valueHolding(holding(1, [lot("2026-01-01", 10, 100)]), price(600)),
        valueHolding(holding(2, [lot("2026-01-01", 10, 100)]), price(300)),
        valueHolding(holding(3, [lot("2026-01-01", 10, 100)]), price(100)),
        valueHolding(holding(4, [lot("2026-01-01", 10, 100)]), null),
      ],
    },
  ])

  it("groups priced stocks by label, unclassified last", () => {
    const sectors = new Map([
      [1, "IT"],
      [3, "IT"],
    ])
    expect(
      groupStocks(stocks, (stock) => sectors.get(stock.instrumentId) ?? null),
    ).toEqual([
      { label: "IT", value: 7000, weightPct: 70, instrumentIds: [1, 3] },
      { label: UNCLASSIFIED, value: 3000, weightPct: 30, instrumentIds: [2] },
    ])
  })

  it("measures how concentrated the stocks are", () => {
    const result = concentration(stocks)
    expect(result.count).toBe(3)
    expect(result.largest).toEqual({ instrumentId: 1, weightPct: 60 })
    expect(result.top5Pct).toBe(100)
    expect(result.effectiveCount).toBeCloseTo(1 / (0.36 + 0.09 + 0.01), 6)
    expect(result.heavy.map((stock) => stock.instrumentId)).toEqual([1, 2])
  })
})

describe("holdingTerms", () => {
  it("splits lots by holding period and lists those turning long-term soon", () => {
    const terms = holdingTerms(
      [
        {
          member: { id: "dad" },
          holdings: [
            valueHolding(
              holding(1, [
                lot("2024-05-01", 10, 100, "opening_balance"),
                lot("2025-10-10", 5, 200),
                lot("2026-03-01", 4, 250),
              ]),
              price(300),
            ),
          ],
        },
      ],
      "2026-09-19",
    )

    expect(terms.longTerm).toEqual({ value: 3000, gain: 2000 })
    expect(terms.shortTerm).toEqual({ value: 2700, gain: 700 })
    expect(terms.estimated).toBe(true)
    expect(terms.soon).toEqual([
      {
        memberId: "dad",
        instrumentId: 1,
        quantity: 5,
        longTermOn: "2026-10-11",
        gain: 500,
      },
    ])
  })
})

describe("longTermUnrealized", () => {
  it("adds up gains and losses of long-term lots only", () => {
    const lots = [
      lot("2024-01-01", 10, 100),
      lot("2024-06-01", 10, 400),
      lot("2026-06-01", 10, 50),
    ]
    expect(longTermUnrealized(lots, 300, "2026-09-19")).toBe(2000 - 1000)
  })
})

describe("monthlyFlows", () => {
  it("adds buys and sells per month, including empty months", () => {
    const rows = monthlyFlows(
      [
        { date: "2026-07-03", amount: -1000 },
        { date: "2026-07-20", amount: -500 },
        { date: "2026-09-01", amount: 800 },
        { date: "2020-01-01", amount: -99 },
      ],
      "2026-09-19",
      3,
    )
    expect(rows).toEqual([
      { month: "2026-07", putIn: 1500, takenOut: 0 },
      { month: "2026-08", putIn: 0, takenOut: 0 },
      { month: "2026-09", putIn: 0, takenOut: 800 },
    ])
  })

  it("crosses the year boundary", () => {
    expect(monthlyFlows([], "2026-02-10", 3).map((row) => row.month)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ])
  })
})
