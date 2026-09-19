import { describe, expect, it } from "vitest"

import {
  buildPosition,
  sortTransactions,
  type PositionTransaction,
} from "@/lib/portfolio/holdings"

let counter = 0
function txn(
  type: PositionTransaction["type"],
  quantity: number,
  price: number,
  tradeDate: string,
  extra: Partial<PositionTransaction> = {},
): PositionTransaction {
  counter += 1
  return {
    id: `t${counter}`,
    type,
    quantity,
    price,
    charges: 0,
    tradeDate,
    createdAt: `2026-01-01T00:00:${String(counter).padStart(2, "0")}Z`,
    ...extra,
  }
}

function position(transactions: PositionTransaction[]) {
  const result = buildPosition(transactions)
  if (!result.ok) throw new Error(result.message)
  return result.position
}

describe("buildPosition", () => {
  it("returns an empty position with no transactions", () => {
    expect(position([])).toEqual({
      quantity: 0,
      invested: 0,
      averageCost: 0,
      realizedPnl: 0,
      lots: [],
      sales: [],
    })
  })

  it("splits every lot on the ex-date without changing what was paid", () => {
    const result = buildPosition(
      [
        txn("buy", 10, 1000, "2024-01-01", { charges: 20 }),
        // Bought on the ex-date, so already at the post-split price.
        txn("buy", 5, 200, "2024-06-03"),
        txn("sell", 40, 250, "2024-07-01"),
      ],
      {
        actions: [
          {
            id: "split",
            kind: "split",
            exDate: "2024-06-03",
            ratioFrom: 1,
            ratioTo: 5,
          },
        ],
      },
    )
    if (!result.ok) throw new Error(result.message)
    // 50 split shares at 200.4 each, then 5 at 200; 40 sold first-in.
    expect(result.position.quantity).toBe(15)
    expect(result.position.invested).toBeCloseTo(10 * 200.4 + 5 * 200)
    expect(result.position.sales[0].costBasis).toBeCloseTo(40 * 200.4)
  })

  it("adds bonus shares as a free lot dated the ex-date, whole shares only", () => {
    const result = buildPosition(
      [txn("opening_balance", 5, 100, "2024-01-01")],
      {
        actions: [
          {
            id: "bonus",
            kind: "bonus",
            exDate: "2024-03-01",
            ratioFrom: 2,
            ratioTo: 1,
          },
        ],
        asOf: "2024-12-31",
      },
    )
    if (!result.ok) throw new Error(result.message)
    // 1 for every 2 held: 5 shares earn 2 (the half share is paid in cash).
    expect(result.position.quantity).toBe(7)
    expect(result.position.invested).toBeCloseTo(500)
    expect(result.position.lots.at(-1)).toMatchObject({
      date: "2024-03-01",
      quantity: 2,
      costPerShare: 0,
    })
  })

  it("lets a sell use bonus shares, and ignores actions not yet due", () => {
    const bonus = {
      id: "bonus",
      kind: "bonus" as const,
      exDate: "2024-03-01",
      ratioFrom: 1,
      ratioTo: 1,
    }
    const sellAfterBonus = buildPosition(
      [txn("buy", 10, 100, "2024-01-01"), txn("sell", 15, 60, "2024-04-01")],
      { actions: [bonus] },
    )
    expect(sellAfterBonus.ok).toBe(true)

    const notYet = buildPosition([txn("buy", 10, 100, "2024-01-01")], {
      actions: [bonus],
      asOf: "2024-02-01",
    })
    expect(notYet.ok && notYet.position.quantity).toBe(10)
  })

  it("records each sell with the cost of the shares it used", () => {
    const result = position([
      txn("buy", 10, 100, "2024-01-01", { charges: 10 }),
      txn("buy", 10, 200, "2024-02-01"),
      txn("sell", 15, 150, "2024-03-01", { charges: 5 }),
    ])
    expect(result.sales).toHaveLength(1)
    const [sale] = result.sales
    expect(sale).toMatchObject({
      date: "2024-03-01",
      quantity: 15,
      price: 150,
      charges: 5,
    })
    // 10 shares at 101 (with charges) and 5 at 200.
    expect(sale.costBasis).toBeCloseTo(2010)
    expect(sale.realizedPnl).toBeCloseTo(2250 - 5 - 2010)
    expect(result.realizedPnl).toBeCloseTo(sale.realizedPnl)
  })

  it("adds buy charges to the cost and averages across lots", () => {
    const result = position([
      txn("opening_balance", 10, 100, "2024-01-01"),
      txn("buy", 10, 120, "2024-02-01", { charges: 20 }),
    ])
    expect(result.quantity).toBe(20)
    expect(result.invested).toBeCloseTo(1000 + 1220)
    expect(result.averageCost).toBeCloseTo(111)
  })

  it("matches sells against the oldest shares first", () => {
    const result = position([
      txn("opening_balance", 10, 100, "2024-01-01"),
      txn("buy", 10, 120, "2024-02-01", { charges: 20 }),
      txn("sell", 15, 150, "2024-03-01", { charges: 15 }),
    ])
    // Sold 10 @ cost 100 and 5 @ cost 122 = 1,610; proceeds 2,250 − 15 charges.
    expect(result.realizedPnl).toBeCloseTo(625)
    expect(result.quantity).toBe(5)
    expect(result.invested).toBeCloseTo(610)
    expect(result.averageCost).toBeCloseTo(122)
    expect(result.lots).toHaveLength(1)
  })

  it("clears the position when everything is sold", () => {
    const result = position([
      txn("buy", 5, 200, "2024-01-01"),
      txn("sell", 5, 180, "2024-01-10"),
    ])
    expect(result.quantity).toBe(0)
    expect(result.averageCost).toBe(0)
    expect(result.realizedPnl).toBeCloseTo(-100)
    expect(result.lots).toEqual([])
  })

  it("handles an intraday buy and sell on the same date", () => {
    const sell = txn("sell", 10, 105, "2024-05-02")
    const buy = txn("buy", 10, 100, "2024-05-02")
    // Saved sell-first, but the buy must count first within the day.
    expect(position([sell, buy]).realizedPnl).toBeCloseTo(50)
  })

  it("rejects selling more than was held on that date", () => {
    const early = txn("sell", 5, 100, "2024-01-01")
    const result = buildPosition([early, txn("buy", 10, 90, "2024-02-01")])
    expect(result).toMatchObject({ ok: false, transactionId: early.id })
    if (!result.ok) expect(result.message).toContain("more than the 0 held")
  })

  it("tolerates floating-point quantities", () => {
    const result = position([
      txn("buy", 0.1, 100, "2024-01-01"),
      txn("buy", 0.2, 100, "2024-01-02"),
      txn("sell", 0.3, 100, "2024-01-03"),
    ])
    expect(result.quantity).toBe(0)
  })
})

describe("sortTransactions", () => {
  it("orders by date, then type, then save time", () => {
    const a = txn("sell", 1, 1, "2024-01-02")
    const b = txn("buy", 1, 1, "2024-01-02")
    const c = txn("opening_balance", 1, 1, "2024-01-01")
    const d = txn("buy", 1, 1, "2024-01-02")
    expect(sortTransactions([a, b, c, d]).map((t) => t.id)).toEqual([
      c.id,
      b.id,
      d.id,
      a.id,
    ])
  })
})
