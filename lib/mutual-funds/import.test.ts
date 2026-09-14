import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { withPreviousNav } = await import("@/lib/mutual-funds/import")

const record = {
  amfi_code: 122639,
  name: "Parag Parikh Flexi Cap Fund",
  amc: "PPFAS Mutual Fund",
  category: "Equity Scheme - Flexi Cap Fund",
  scheme_type: "Open Ended",
  plan: "direct" as const,
  option_type: "growth" as const,
  option_label: "Growth",
  isin_growth: "INF879O01027",
  isin_reinvest: null,
  nav: 90.1,
  nav_date: "2026-09-14",
}

describe("withPreviousNav", () => {
  it("moves the stored NAV to previous when the NAV date advances", () => {
    expect(
      withPreviousNav(record, {
        amfi_code: 122639,
        nav: 89.5712,
        nav_date: "2026-09-11",
        previous_nav: 89.2,
        previous_nav_date: "2026-09-10",
      }),
    ).toMatchObject({
      nav: 90.1,
      previous_nav: 89.5712,
      previous_nav_date: "2026-09-11",
    })
  })

  it("keeps the old previous NAV when the date hasn't changed (job ran twice)", () => {
    expect(
      withPreviousNav(record, {
        amfi_code: 122639,
        nav: 90.1,
        nav_date: "2026-09-14",
        previous_nav: 89.5712,
        previous_nav_date: "2026-09-11",
      }),
    ).toMatchObject({ previous_nav: 89.5712, previous_nav_date: "2026-09-11" })
  })

  it("has no previous NAV for a fund seen for the first time", () => {
    expect(withPreviousNav(record)).toMatchObject({
      previous_nav: null,
      previous_nav_date: null,
    })
  })
})
