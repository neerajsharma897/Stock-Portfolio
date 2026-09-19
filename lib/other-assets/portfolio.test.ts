import { describe, expect, it } from "vitest"

import {
  depositForTotals,
  depositValueOn,
  otherAssetForTotals,
  valueDeposit,
  type DepositTerms,
} from "@/lib/other-assets/portfolio"

const fd: DepositTerms = {
  principal: 100_000,
  ratePct: 7,
  interest: "quarterly",
  startDate: "2025-01-01",
  maturityDate: "2026-01-01",
  closedOn: null,
}

describe("depositValueOn", () => {
  it("compounds quarterly over a year", () => {
    expect(depositValueOn(fd, "2026-01-01")).toBeCloseTo(
      100_000 * 1.0175 ** 4,
      2,
    )
  })

  it("stops growing at maturity and is the principal before it starts", () => {
    expect(depositValueOn(fd, "2027-06-01")).toBeCloseTo(
      depositValueOn(fd, "2026-01-01"),
    )
    expect(depositValueOn(fd, "2024-12-01")).toBe(100_000)
  })

  it("keeps payout FDs at the principal", () => {
    expect(depositValueOn({ ...fd, interest: "payout" }, "2025-09-01")).toBe(
      100_000,
    )
  })

  it("grows part-way through the term", () => {
    const halfWay = depositValueOn({ ...fd, interest: "monthly" }, "2025-07-02")
    expect(halfWay).toBeGreaterThan(103_000)
    expect(halfWay).toBeLessThan(103_700)
  })
})

describe("valueDeposit and the totals", () => {
  it("counts running FDs at today's value and drops closed ones", () => {
    const running = valueDeposit(fd, "2025-07-02")
    expect(running.matured).toBe(false)
    expect(running.maturityValue).toBeCloseTo(107_185.9, 1)
    expect(depositForTotals(running, "2025-07-02")).toMatchObject({
      position: { quantity: 1, invested: 100_000 },
      dayChange: null,
    })

    const closed = valueDeposit({ ...fd, closedOn: "2026-01-01" }, "2026-02-01")
    expect(closed.closed).toBe(true)
    expect(depositForTotals(closed, "2026-02-01").position.quantity).toBe(0)
  })

  it("counts other assets at their last valuation", () => {
    expect(
      otherAssetForTotals({
        invested: 50_000,
        currentValue: 72_000,
        valueAsOf: "2026-09-01",
      }),
    ).toMatchObject({
      currentValue: 72_000,
      unrealizedPnl: 22_000,
      price: { pricedAt: "2026-09-01" },
    })
  })
})
