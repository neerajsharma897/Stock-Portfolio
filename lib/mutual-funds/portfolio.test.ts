import { describe, expect, it } from "vitest"

import {
  annualReturn,
  combinedReturn,
  forFamilyTotals,
  groupFundHoldings,
  valueFund,
  type FundTransactionForHolding,
} from "@/lib/mutual-funds/portfolio"

const ACCOUNT = "groww"

function entry(
  overrides: Partial<FundTransactionForHolding> &
    Pick<FundTransactionForHolding, "id">,
): FundTransactionForHolding {
  return {
    type: "buy",
    quantity: 100,
    price: 10,
    charges: 0,
    tradeDate: "2025-01-01",
    createdAt: "2025-01-01T10:00:00Z",
    brokerAccountId: ACCOUNT,
    amfiCode: 122639,
    ...overrides,
  }
}

describe("groupFundHoldings", () => {
  it("groups by account and fund and keeps every cash flow", () => {
    const { holdings, problems } = groupFundHoldings([
      entry({ id: "a", type: "opening_balance" }),
      entry({
        id: "b",
        tradeDate: "2025-02-05",
        quantity: 50,
        price: 11,
        charges: 0.03,
      }),
      entry({ id: "c", amfiCode: 120503, price: 20 }),
      entry({
        id: "d",
        type: "sell",
        tradeDate: "2025-03-01",
        quantity: 30,
        price: 12,
      }),
    ])
    expect(problems).toEqual([])
    const parag = holdings.find((holding) => holding.amfiCode === 122639)!
    expect(parag.position.quantity).toBe(120)
    expect(parag.flows).toEqual([
      { date: "2025-01-01", amount: -1000 },
      { date: "2025-02-05", amount: -550.03 },
      { date: "2025-03-01", amount: 360 },
    ])
    expect(holdings).toHaveLength(2)
  })

  it("reports redeeming more units than held", () => {
    const { holdings, problems } = groupFundHoldings([
      entry({ id: "a", quantity: 10 }),
      entry({ id: "b", type: "sell", quantity: 15, tradeDate: "2025-02-01" }),
    ])
    expect(holdings).toEqual([])
    expect(problems).toHaveLength(1)
    expect(problems[0].message).toMatch(/^The redemption of 15 on /)
  })
})

describe("valueFund", () => {
  const [held] = groupFundHoldings([entry({ id: "a" })]).holdings

  it("values units at the latest NAV, with the NAV change and XIRR", () => {
    const valued = valueFund(held, {
      nav: 12,
      navDate: "2026-01-01",
      previousNav: 11.5,
    })
    expect(valued.currentValue).toBe(1200)
    expect(valued.unrealizedPnl).toBe(200)
    expect(valued.unrealizedPct).toBe(20)
    expect(valued.dayChange).toBe(50)
    expect(valued.dayChangePct).toBeCloseTo(4.3478, 4)
    expect(valued.xirr).toBeCloseTo(0.2, 6)
    expect(valued.price?.pricedAt).toBe("2026-01-01")
  })

  it("leaves XIRR out under a year and values nothing without a NAV", () => {
    expect(
      valueFund(held, { nav: 12, navDate: "2025-06-01", previousNav: null }),
    ).toMatchObject({ currentValue: 1200, dayChange: null, xirr: null })
    expect(valueFund(held, null)).toMatchObject({
      price: null,
      currentValue: null,
      unrealizedPnl: null,
      xirr: null,
    })
  })

  it("gives a redeemed fund its XIRR from the entries alone", () => {
    const [redeemed] = groupFundHoldings([
      entry({ id: "a" }),
      entry({ id: "b", type: "sell", price: 11, tradeDate: "2026-01-01" }),
    ]).holdings
    const valued = valueFund(redeemed, null)
    expect(valued.currentValue).toBeNull()
    expect(valued.position.realizedPnl).toBe(100)
    expect(valued.xirr).toBeCloseTo(0.1, 6)
  })
})

describe("combinedReturn and forFamilyTotals", () => {
  const { holdings } = groupFundHoldings([
    entry({ id: "a" }),
    entry({ id: "b", amfiCode: 120503, price: 20, quantity: 50 }),
  ])
  const nav = { navDate: "2026-01-01", previousNav: 10 }

  it("combines several funds into one XIRR", () => {
    const funds = [
      valueFund(holdings[0], { ...nav, nav: 11 }),
      valueFund(holdings[1], { ...nav, nav: 26 }),
    ]
    // 2,000 invested on 1 Jan 2025 is worth 1,100 + 1,300 a year later.
    expect(combinedReturn(funds)).toBeCloseTo(0.2, 6)
    expect(
      forFamilyTotals(funds).every((fund) => fund.dayChange === null),
    ).toBe(true)
  })

  it("is null when a held fund has no NAV", () => {
    expect(
      combinedReturn([
        valueFund(holdings[0], { ...nav, nav: 11 }),
        valueFund(holdings[1], null),
      ]),
    ).toBeNull()
  })

  it("annualReturn needs at least a year", () => {
    expect(
      annualReturn([{ date: "2025-01-01", amount: -100 }], {
        date: "2025-12-31",
        amount: 110,
      }),
    ).toBeNull()
  })
})
