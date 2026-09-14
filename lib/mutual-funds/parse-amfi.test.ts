import { describe, expect, it } from "vitest"

import {
  normaliseOption,
  normalisePlan,
  parseAmfiDate,
  parseAmfiNav,
} from "@/lib/mutual-funds/parse-amfi"

// Lines copied from the real NAVAll.txt (September 2026), with Windows line endings.
const FILE = [
  "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date",
  " ",
  "Open Ended Schemes(Equity Scheme - Flexi Cap Fund)",
  " ",
  "PPFAS Mutual Fund",
  " ",
  "122639;INF879O01027;-;Parag Parikh Flexi Cap Fund;Direct Plan;Growth;89.5712;11-Sep-2026",
  "153964;-;INF879O01308;Parag Parikh Flexi Cap Fund;Direct Plan;Monthly IDCW Payout;89.5712;11-Sep-2026",
  "122640;INF879O01019;-;Parag Parikh Flexi Cap Fund;Regular Plan;Growth;81.6012;11-Sep-2026",
  " ",
  "Open Ended Schemes(Children’s Fund - Childrens' Fund)",
  " ",
  "Axis Mutual Fund",
  " ",
  "135763;INF846K01WS2;INF846K01WQ6;Axis Children's Fund;Direct Plan;IDCW Option;27.6533;11-Sep-2026",
  "Close Ended Schemes(Income)",
  "Old Fund House Mutual Fund",
  "100027;INF178L01BT0 ;Redeemed;Old Liquid Fund - Regular Plan - Growth;;;10.;02-Jul-2018",
  "999999;broken line;with;too few fields",
].join("\r\n")

describe("parseAmfiNav", () => {
  const records = parseAmfiNav(FILE)
  const byCode = new Map(records.map((record) => [record.amfi_code, record]))

  it("reads every well-formed fund line and skips broken ones", () => {
    expect(records.map((record) => record.amfi_code)).toEqual([
      122639, 153964, 122640, 135763, 100027,
    ])
  })

  it("keeps the category, fund house, plan, option, ISINs, NAV and date", () => {
    expect(byCode.get(122639)).toEqual({
      amfi_code: 122639,
      name: "Parag Parikh Flexi Cap Fund",
      amc: "PPFAS Mutual Fund",
      category: "Equity Scheme - Flexi Cap Fund",
      scheme_type: "Open Ended",
      plan: "direct",
      option_type: "growth",
      option_label: "Growth",
      isin_growth: "INF879O01027",
      isin_reinvest: null,
      nav: 89.5712,
      nav_date: "2026-09-11",
    })
  })

  it("handles IDCW variants and missing payout ISINs", () => {
    expect(byCode.get(153964)).toMatchObject({
      option_type: "idcw",
      option_label: "Monthly IDCW Payout",
      isin_growth: null,
      isin_reinvest: "INF879O01308",
    })
    expect(byCode.get(135763)).toMatchObject({
      amc: "Axis Mutual Fund",
      category: "Children’s Fund - Childrens' Fund",
      option_type: "idcw",
    })
  })

  it("fills blank plan and option from the name and cleans odd values", () => {
    expect(byCode.get(100027)).toMatchObject({
      scheme_type: "Close Ended",
      category: "Income",
      amc: "Old Fund House Mutual Fund",
      plan: "regular",
      option_type: "growth",
      option_label: null,
      isin_growth: "INF178L01BT0",
      isin_reinvest: null,
      nav: 10,
      nav_date: "2018-07-02",
    })
  })
})

describe("helpers", () => {
  it("parses AMFI dates", () => {
    expect(parseAmfiDate("11-Sep-2026")).toBe("2026-09-11")
    expect(parseAmfiDate("02-oct-2008")).toBe("2008-10-02")
    expect(parseAmfiDate("2026-09-11")).toBeNull()
  })

  it("prefers the Plan column, then the name", () => {
    expect(normalisePlan("Regular Plan", "X Fund - Direct")).toBe("regular")
    expect(normalisePlan("", "X Fund - Direct Plan - Growth")).toBe("direct")
    expect(normalisePlan("", "X Fund")).toBeNull()
  })

  it("treats growth-named dividend yield funds as growth", () => {
    expect(
      normaliseOption("", "ABC Dividend Yield Fund - Growth").option_type,
    ).toBe("growth")
    expect(
      normaliseOption("IDCW (Income Distribution CUM Capital Withdrawal)", "X")
        .option_type,
    ).toBe("idcw")
    expect(normaliseOption("", "Some Fund").option_type).toBeNull()
  })
})
