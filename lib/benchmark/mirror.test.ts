import { describe, expect, it } from "vitest"

import { closeOn, mirrorIndex } from "@/lib/benchmark/mirror"

const closes = [
  { date: "2025-01-01", close: 100 },
  { date: "2025-01-02", close: 110 },
  { date: "2025-01-06", close: 120 },
  { date: "2026-09-18", close: 200 },
]

describe("closeOn", () => {
  it("uses the last close on or before the date", () => {
    expect(closeOn(closes, "2025-01-02")).toBe(110)
    expect(closeOn(closes, "2025-01-04")).toBe(110)
    expect(closeOn(closes, "2026-09-19")).toBe(200)
  })

  it("uses the first close for earlier dates, and nothing without closes", () => {
    expect(closeOn(closes, "2020-01-01")).toBe(100)
    expect(closeOn([], "2025-01-01")).toBeNull()
  })
})

describe("mirrorIndex", () => {
  it("puts the same money into the index on the same days", () => {
    const mirror = mirrorIndex(
      [
        { date: "2025-01-01", amount: -10_000 }, // 100 units
        { date: "2025-01-04", amount: -11_000 }, // 100 units at 110
        { date: "2025-01-06", amount: 6_000 }, // sells 50 units at 120
      ],
      closes,
    )
    expect(mirror).not.toBeNull()
    expect(mirror?.netInvested).toBe(15_000)
    expect(mirror?.value).toBeCloseTo(150 * 200, 6)
    expect(mirror?.gain).toBeCloseTo(30_000 - 15_000, 6)
    expect(mirror?.valuedOn).toBe("2026-09-18")
    expect(mirror?.xirr).not.toBeNull()
  })

  it("needs flows and closes", () => {
    expect(mirrorIndex([], closes)).toBeNull()
    expect(mirrorIndex([{ date: "2025-01-01", amount: -1 }], [])).toBeNull()
  })
})
