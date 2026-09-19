import { describe, expect, it } from "vitest"

import { estimateCryptoTax, financialYearOf } from "@/lib/crypto/tax"
import type { Sale } from "@/lib/portfolio/holdings"

function sale(date: string, value: number, costBasis: number): Sale {
  return {
    transactionId: date,
    date,
    quantity: 1,
    price: value,
    charges: 10,
    costBasis,
    realizedPnl: value - 10 - costBasis,
  }
}

describe("financialYearOf", () => {
  it("runs from April to March", () => {
    expect(financialYearOf("2026-09-15")).toEqual({
      label: "FY 2026-27",
      start: "2026-04-01",
      end: "2027-03-31",
    })
    expect(financialYearOf("2027-03-31").label).toBe("FY 2026-27")
    expect(financialYearOf("2000-01-05").label).toBe("FY 1999-00")
  })
})

describe("estimateCryptoTax", () => {
  it("taxes each gain at 30% plus cess, ignores losses and counts TDS on sale value", () => {
    const year = financialYearOf("2026-09-15")
    const estimate = estimateCryptoTax(
      [
        { position: { sales: [sale("2026-05-01", 10_000, 6_000)] } },
        {
          position: {
            sales: [
              sale("2026-06-01", 3_000, 5_000),
              // Previous financial year: not counted.
              sale("2026-03-31", 50_000, 1_000),
            ],
          },
        },
      ],
      year,
    )
    expect(estimate.saleCount).toBe(2)
    expect(estimate.saleValue).toBe(13_000)
    // Selling fees aren't deductible, so the gain is 10,000 − 6,000.
    expect(estimate.gains).toBe(4_000)
    expect(estimate.losses).toBe(-2_000)
    expect(estimate.tax).toBeCloseTo(4_000 * 0.3 * 1.04)
    expect(estimate.tds).toBeCloseTo(130)
  })
})
