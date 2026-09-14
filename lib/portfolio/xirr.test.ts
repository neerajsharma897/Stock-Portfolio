import { describe, expect, it } from "vitest"

import { xirr } from "@/lib/portfolio/xirr"

describe("xirr", () => {
  it("matches Excel's documented XIRR example (37.34%)", () => {
    // From Microsoft's XIRR function documentation.
    const rate = xirr([
      { date: "2008-01-01", amount: -10000 },
      { date: "2008-03-01", amount: 2750 },
      { date: "2008-10-30", amount: 4250 },
      { date: "2009-02-15", amount: 3250 },
      { date: "2009-04-01", amount: 2750 },
    ])
    expect(rate).toBeCloseTo(0.373362535, 6)
  })

  it("gives 10% for 1,000 growing to 1,100 over 365 days", () => {
    expect(
      xirr([
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: 1100 },
      ]),
    ).toBeCloseTo(0.1, 6)
  })

  it("handles losses and SIP-style monthly investments", () => {
    expect(
      xirr([
        { date: "2025-01-01", amount: -1000 },
        { date: "2026-01-01", amount: 800 },
      ]),
    ).toBeCloseTo(-0.2, 6)

    const sip = [
      { date: "2025-01-05", amount: -5000 },
      { date: "2025-02-05", amount: -5000 },
      { date: "2025-03-05", amount: -5000 },
      { date: "2025-04-05", amount: 15600 },
    ]
    const rate = xirr(sip)
    expect(rate).not.toBeNull()
    expect(rate!).toBeGreaterThan(0.1)
    expect(rate!).toBeLessThan(0.3)
  })

  it("returns null without both money in and money out", () => {
    expect(xirr([{ date: "2025-01-01", amount: -1000 }])).toBeNull()
    expect(
      xirr([
        { date: "2025-01-01", amount: 1000 },
        { date: "2026-01-01", amount: 1100 },
      ]),
    ).toBeNull()
    expect(xirr([])).toBeNull()
  })
})
