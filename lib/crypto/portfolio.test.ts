import { describe, expect, it } from "vitest"

import {
  forFamilyTotals,
  groupCryptoHoldings,
  valueCrypto,
  type CryptoTransactionForHolding,
} from "@/lib/crypto/portfolio"

function entry(
  overrides: Partial<CryptoTransactionForHolding> &
    Pick<CryptoTransactionForHolding, "id">,
): CryptoTransactionForHolding {
  return {
    type: "buy",
    quantity: 0.01,
    price: 6_000_000,
    charges: 0,
    tradeDate: "2026-01-10",
    createdAt: "2026-01-10T10:00:00Z",
    brokerAccountId: "coindcx",
    market: "BTCINR",
    ...overrides,
  }
}

describe("groupCryptoHoldings", () => {
  it("groups by account and coin", () => {
    const { holdings, problems } = groupCryptoHoldings([
      entry({ id: "a", type: "opening_balance", quantity: 0.02 }),
      entry({ id: "b", market: "SHIBINR", quantity: 2_000_000, price: 0.001 }),
      entry({
        id: "c",
        type: "sell",
        quantity: 0.005,
        price: 7_000_000,
        tradeDate: "2026-02-01",
      }),
    ])
    expect(problems).toEqual([])
    const bitcoin = holdings.find((holding) => holding.market === "BTCINR")!
    expect(bitcoin.position.quantity).toBe(0.015)
    expect(bitcoin.position.realizedPnl).toBeCloseTo(5000)
    expect(holdings).toHaveLength(2)
  })

  it("reports selling more coins than held", () => {
    const { holdings, problems } = groupCryptoHoldings([
      entry({ id: "a" }),
      entry({ id: "b", type: "sell", quantity: 0.02, tradeDate: "2026-02-01" }),
    ])
    expect(holdings).toEqual([])
    expect(problems[0].message).toMatch(/^The sell of 0\.02 on /)
  })
})

describe("valueCrypto", () => {
  const [held] = groupCryptoHoldings([entry({ id: "a" })]).holdings

  it("values coins at the latest price with the 24-hour change", () => {
    const valued = valueCrypto(held, {
      lastPrice: 6_600_000,
      change24hPct: 10,
      pricedAt: "2026-09-15T06:05:49.000Z",
    })
    expect(valued.currentValue).toBeCloseTo(66_000)
    expect(valued.unrealizedPnl).toBeCloseTo(6000)
    expect(valued.unrealizedPct).toBeCloseTo(10)
    expect(valued.price?.previousClose).toBeCloseTo(6_000_000)
    expect(valued.dayChange).toBeCloseTo(6000)
    expect(valued.dayChangePct).toBe(10)
    expect(forFamilyTotals([valued])[0].dayChange).toBeNull()
  })

  it("values nothing without a price, and no day change without a 24-hour change", () => {
    expect(valueCrypto(held, null)).toMatchObject({
      price: null,
      currentValue: null,
      dayChange: null,
    })
    expect(
      valueCrypto(held, {
        lastPrice: 6_000_000,
        change24hPct: null,
        pricedAt: "2026-09-15T06:05:49.000Z",
      }),
    ).toMatchObject({ currentValue: 60_000, dayChange: null })
  })
})
