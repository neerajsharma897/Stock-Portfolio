import { describe, expect, it } from "vitest"

import {
  fundSearchWords,
  isStaleNav,
  parseSchemeCode,
  rankFunds,
} from "@/lib/mutual-funds/search"

describe("fundSearchWords", () => {
  it("keeps letters and digits, lower-cased", () => {
    expect(fundSearchWords("  Parag Parikh, Flexi-Cap (Direct)% ")).toEqual([
      "parag",
      "parikh",
      "flexi",
      "cap",
      "direct",
    ])
    expect(fundSearchWords("%_,()")).toEqual([])
  })
})

describe("parseSchemeCode", () => {
  it("reads a scheme code on its own", () => {
    expect(parseSchemeCode(" 122639 ")).toBe(122639)
    expect(parseSchemeCode("122639 direct")).toBeNull()
  })
})

describe("rankFunds", () => {
  const today = "2026-09-15"

  it("puts current funds first, then names starting with the first word", () => {
    const funds = [
      { name: "Old Axis Fund", nav_date: "2019-01-01" },
      { name: "HDFC Axis Blend", nav_date: "2026-09-11" },
      { name: "Axis Bluechip Fund", nav_date: "2026-09-11" },
      { name: "Axis Aggressive Fund", nav_date: null },
    ]
    expect(
      rankFunds(funds, ["axis"], today, 10).map((fund) => fund.name),
    ).toEqual([
      "Axis Bluechip Fund",
      "HDFC Axis Blend",
      "Axis Aggressive Fund",
      "Old Axis Fund",
    ])
    expect(rankFunds(funds, ["axis"], today, 1)).toHaveLength(1)
  })

  it("treats NAVs older than 30 days as stale", () => {
    expect(isStaleNav("2026-08-20", today)).toBe(false)
    expect(isStaleNav("2026-08-10", today)).toBe(true)
  })
})
