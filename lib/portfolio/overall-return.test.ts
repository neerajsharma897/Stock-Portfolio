import { describe, expect, it } from "vitest"

import { valueDeposit } from "@/lib/other-assets/portfolio"
import { overallReturn } from "@/lib/portfolio/overall-return"

const stock = {
  flows: [{ date: "2025-01-01", amount: -1000 }],
  position: { quantity: 10 },
  currentValue: 1200,
  price: { pricedAt: "2026-01-01T09:00:00Z" },
}

describe("overallReturn", () => {
  it("combines stocks and FDs into one yearly return", () => {
    const fd = valueDeposit(
      {
        principal: 1000,
        ratePct: 20,
        interest: "yearly",
        startDate: "2025-01-01",
        maturityDate: "2027-01-01",
        closedOn: null,
      },
      "2026-01-01",
    )
    // 2,000 in on 1 Jan 2025 is worth 1,200 + 1,200 a year later: 20%.
    expect(
      overallReturn(
        { holdings: [stock], funds: [], crypto: [], deposits: [fd] },
        "2026-01-01",
      ),
    ).toBeCloseTo(0.2, 3)
  })

  it("waits for a price on every held holding, and for a year of history", () => {
    expect(
      overallReturn(
        {
          holdings: [stock, { ...stock, currentValue: null, price: null }],
          funds: [],
          crypto: [],
          deposits: [],
        },
        "2026-01-01",
      ),
    ).toBeNull()
    expect(
      overallReturn(
        {
          holdings: [{ ...stock, price: { pricedAt: "2025-06-01T09:00:00Z" } }],
          funds: [],
          crypto: [],
          deposits: [],
        },
        "2025-06-01",
      ),
    ).toBeNull()
  })
})
