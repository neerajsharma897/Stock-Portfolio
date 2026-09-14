import { describe, expect, it } from "vitest"

import type { MarketStatus } from "@/lib/market-hours"
import { describeLiveStatus, type LiveStatus } from "@/lib/prices/live-status"

const openMarket: MarketStatus = {
  open: true,
  date: "2026-09-14",
  reason: "open",
  holiday: null,
}

function status(overrides: Partial<LiveStatus>): LiveStatus {
  return {
    configured: true,
    market: openMarket,
    refreshed: 0,
    lastFetchedAt: null,
    error: null,
    ...overrides,
  }
}

describe("describeLiveStatus", () => {
  it("says prices are manual until Angel One is set up", () => {
    expect(describeLiveStatus(status({ configured: false }))).toMatchObject({
      tone: "manual",
      label: "Prices entered by hand",
    })
  })

  it("shows errors before anything else", () => {
    expect(
      describeLiveStatus(
        status({ error: "Angel One login failed: Invalid totp" }),
      ),
    ).toEqual({
      tone: "error",
      label: "Live prices unavailable",
      detail: "Angel One login failed: Invalid totp",
    })
  })

  it("shows the update time in India while the market is open", () => {
    const badge = describeLiveStatus(
      status({ lastFetchedAt: "2026-09-14T04:30:05Z" }),
    )
    expect(badge.tone).toBe("live")
    expect(badge.detail).toMatch(/^updated 10:00:05\s?am$/i)
  })

  it("names the reason the market is closed", () => {
    const holiday = describeLiveStatus(
      status({
        market: {
          open: false,
          date: "2026-10-20",
          reason: "holiday",
          holiday: "Diwali",
        },
      }),
    )
    expect(holiday).toEqual({
      tone: "closed",
      label: "Market holiday: Diwali",
      detail: null,
    })

    const afterClose = describeLiveStatus(
      status({
        market: { ...openMarket, open: false, reason: "after_close" },
        lastFetchedAt: "2026-09-14T10:00:00Z",
      }),
    )
    expect(afterClose.label).toBe("Market closed")
    expect(afterClose.detail).toMatch(/^prices as of 14 Sept?, 3:30\s?pm$/i)
  })
})
