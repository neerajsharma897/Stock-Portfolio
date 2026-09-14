import { describe, expect, it } from "vitest"

import { getMarketStatus } from "@/lib/market-hours"

// India is UTC+05:30. 14 Sept 2026 is a Monday; 12 Sept 2026 is a Saturday.
const at = (iso: string) => new Date(iso)

describe("getMarketStatus", () => {
  it("is open during the session on a weekday", () => {
    expect(getMarketStatus(at("2026-09-14T04:30:00Z"))).toEqual({
      open: true,
      date: "2026-09-14",
      reason: "open",
      holiday: null,
    })
  })

  it("opens at 09:15 and closes at 15:30 India time", () => {
    expect(getMarketStatus(at("2026-09-14T03:44:00Z")).reason).toBe(
      "before_open",
    )
    expect(getMarketStatus(at("2026-09-14T03:45:00Z")).open).toBe(true)
    expect(getMarketStatus(at("2026-09-14T09:59:00Z")).open).toBe(true)
    expect(getMarketStatus(at("2026-09-14T10:00:00Z")).reason).toBe(
      "after_close",
    )
  })

  it("is closed at weekends", () => {
    expect(getMarketStatus(at("2026-09-12T05:00:00Z"))).toMatchObject({
      open: false,
      reason: "weekend",
    })
  })

  it("is closed on a listed holiday, using the India date", () => {
    const holidays = new Map([["2026-09-14", "Test holiday"]])
    // 05:00 UTC is 10:30 in India: inside session hours, but a holiday.
    expect(getMarketStatus(at("2026-09-14T05:00:00Z"), holidays)).toEqual({
      open: false,
      date: "2026-09-14",
      reason: "holiday",
      holiday: "Test holiday",
    })
  })
})
