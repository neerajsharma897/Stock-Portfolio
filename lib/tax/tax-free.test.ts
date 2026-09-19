import { describe, expect, it } from "vitest"

import { financialYearOf } from "@/lib/crypto/tax"
import type { GainLine } from "@/lib/tax/capital-gains"
import { taxFreeRoom } from "@/lib/tax/tax-free"

const year = financialYearOf("2026-09-19")

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

describe("taxFreeRoom", () => {
  it("counts long-term gains booked this year against the limit", () => {
    const room = taxFreeRoom(
      [
        line({ gain: 40_000 }),
        line({ gain: 90_000, saleDate: "2026-03-10" }), // last year
        line({ gain: 10_000, asset: "equity_fund" }),
        line({ gain: 50_000, asset: "crypto", term: null }),
      ],
      year,
      200_000,
    )
    expect(room).toEqual({
      limit: 125_000,
      used: 50_000,
      left: 75_000,
      longTermGain: 200_000,
      bookable: 75_000,
    })
  })

  it("lets short-term losses reduce the long-term gain used", () => {
    const room = taxFreeRoom(
      [line({ gain: 60_000 }), line({ gain: -20_000, term: "short" })],
      year,
      10_000,
    )
    expect(room.used).toBe(40_000)
    expect(room.bookable).toBe(10_000)
  })

  it("has nothing bookable while long-term holdings are at a loss", () => {
    expect(taxFreeRoom([], year, -5_000).bookable).toBe(0)
  })
})
