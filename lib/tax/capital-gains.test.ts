import { describe, expect, it } from "vitest"

import { financialYearOf } from "@/lib/crypto/tax"
import type { Sale } from "@/lib/portfolio/holdings"
import {
  fundTaxClass,
  gainLines,
  isLongTerm,
  summarizeGains,
  type GainLine,
} from "@/lib/tax/capital-gains"

const year = financialYearOf("2026-09-19")

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    transactionId: "s1",
    date: "2026-06-01",
    quantity: 30,
    price: 200,
    charges: 30,
    costBasis: 0,
    realizedPnl: 0,
    matched: [
      {
        date: "2024-01-10",
        quantity: 10,
        cost: 1000,
        source: "opening_balance",
      },
      { date: "2026-01-10", quantity: 20, cost: 3000, source: "buy" },
    ],
    ...overrides,
  }
}

function line(overrides: Partial<GainLine>): GainLine {
  return {
    asset: "equity",
    name: "TCS",
    memberId: "m",
    saleDate: "2026-06-01",
    boughtFrom: "2024-01-01",
    boughtTo: "2024-01-01",
    quantity: 1,
    saleValue: 0,
    expenses: 0,
    cost: 0,
    gain: 0,
    term: "long",
    estimated: false,
    ...overrides,
  }
}

describe("isLongTerm", () => {
  it("needs more than the full number of months", () => {
    expect(isLongTerm("2025-06-01", "2026-06-01", 12)).toBe(false)
    expect(isLongTerm("2025-06-01", "2026-06-02", 12)).toBe(true)
    expect(isLongTerm("2024-11-15", "2026-11-16", 24)).toBe(true)
  })
})

describe("gainLines", () => {
  it("splits a sell by holding period and shares out the selling charges", () => {
    const [long, short] = gainLines(sale(), {
      asset: "equity",
      name: "TCS",
      memberId: "m",
    })
    expect(long).toMatchObject({
      term: "long",
      quantity: 10,
      saleValue: 2000,
      expenses: 10,
      cost: 1000,
      gain: 990,
      estimated: true,
    })
    expect(short).toMatchObject({
      term: "short",
      quantity: 20,
      gain: 4000 - 20 - 3000,
      estimated: false,
    })
  })

  it("keeps crypto as one line with no selling charges deducted", () => {
    const lines = gainLines(sale(), {
      asset: "crypto",
      name: "BTC",
      memberId: "m",
    })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ term: null, expenses: 0, gain: 2000 })
  })
})

describe("summarizeGains", () => {
  it("sets short-term losses against long-term gains, then applies the ₹1.25 lakh exemption", () => {
    const summary = summarizeGains(
      [
        line({ term: "long", gain: 200_000 }),
        line({ term: "short", gain: -25_000 }),
        // Previous financial year: left out.
        line({ saleDate: "2026-03-31", gain: 999_999 }),
      ],
      year,
    )
    expect(summary.lines).toHaveLength(2)
    expect(summary.equity).toMatchObject({
      shortTerm: -25_000,
      longTerm: 200_000,
      exemption: 125_000,
      taxableShortTerm: 0,
      taxableLongTerm: 50_000,
    })
    expect(summary.equity.tax).toBeCloseTo(50_000 * 0.125 * 1.04)
  })

  it("taxes short-term equity gains at 20% and each crypto gain at 30%", () => {
    const summary = summarizeGains(
      [
        line({ term: "short", gain: 10_000 }),
        line({ asset: "crypto", term: null, gain: 5_000, saleValue: 20_000 }),
        line({ asset: "crypto", term: null, gain: -3_000, saleValue: 10_000 }),
      ],
      year,
    )
    expect(summary.equity.tax).toBeCloseTo(10_000 * 0.2 * 1.04)
    expect(summary.crypto).toEqual({
      gains: 5_000,
      losses: -3_000,
      tax: 5_000 * 0.3 * 1.04,
      tds: 300,
    })
  })
})

describe("fundTaxClass", () => {
  it("treats equity-oriented funds like shares", () => {
    expect(
      fundTaxClass("Equity Scheme - Flexi Cap Fund", "Parag Parikh Flexi Cap"),
    ).toBe("equity_fund")
    expect(
      fundTaxClass("Other Scheme - Index Funds", "UTI Nifty 50 Index Fund"),
    ).toBe("equity_fund")
    expect(
      fundTaxClass("Other Scheme - Index Funds", "Bharat Bond Index Fund"),
    ).toBe("other_fund")
    expect(fundTaxClass("Debt Scheme - Liquid Fund", "HDFC Liquid")).toBe(
      "other_fund",
    )
    expect(fundTaxClass(null, "Unknown")).toBe("other_fund")
  })
})
