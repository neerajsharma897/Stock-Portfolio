import { describe, expect, it } from "vitest"

import { categorySplit, fundCategory } from "@/lib/mutual-funds/categories"

describe("fundCategory", () => {
  it("reads AMFI's scheme categories", () => {
    expect(fundCategory("Equity Scheme - Large Cap Fund")).toEqual({
      group: "Equity",
      name: "Large Cap",
    })
    expect(fundCategory("Debt Scheme - Banking and PSU Fund")).toEqual({
      group: "Debt",
      name: "Banking and PSU",
    })
    expect(fundCategory("Hybrid Scheme - Aggressive Hybrid Fund").group).toBe(
      "Hybrid",
    )
    expect(fundCategory("Other Scheme - Index Funds")).toEqual({
      group: "Index funds & ETFs",
      name: "Index",
    })
    expect(fundCategory("Other Scheme - FoF Overseas").group).toBe(
      "Fund of funds",
    )
    expect(
      fundCategory("Solution Oriented Scheme - Retirement Fund").group,
    ).toBe("Solution oriented")
  })

  it("handles old categories and missing ones", () => {
    expect(fundCategory("Income")).toEqual({ group: "Debt", name: "Income" })
    expect(fundCategory("ELSS").group).toBe("Equity")
    expect(fundCategory(null)).toEqual({ group: "Other", name: "Other" })
  })
})

describe("categorySplit", () => {
  it("adds up valued funds by group and category", () => {
    const split = categorySplit([
      { category: "Equity Scheme - Large Cap Fund", value: 500 },
      { category: "Equity Scheme - Large Cap Fund", value: 100 },
      { category: "Equity Scheme - Mid Cap Fund", value: 200 },
      { category: "Debt Scheme - Liquid Fund", value: 200 },
      { category: "Debt Scheme - Liquid Fund", value: null },
    ])
    expect(split).toEqual([
      {
        name: "Equity",
        value: 800,
        weightPct: 80,
        categories: [
          { name: "Large Cap", value: 600, weightPct: 60 },
          { name: "Mid Cap", value: 200, weightPct: 20 },
        ],
      },
      {
        name: "Debt",
        value: 200,
        weightPct: 20,
        categories: [{ name: "Liquid", value: 200, weightPct: 20 }],
      },
    ])
  })
})
