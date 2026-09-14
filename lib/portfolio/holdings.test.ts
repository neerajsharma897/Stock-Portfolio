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
    })
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
