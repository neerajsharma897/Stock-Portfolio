import { describe, expect, it } from "vitest"

import {
  describeRule,
  firedToday,
  isQuietHours,
  priceAlertMessage,
  ruleMet,
  type QuoteForCheck,
} from "@/lib/alerts/rules"
import { dailySummaryMessage } from "@/lib/alerts/summary"
import { summarize } from "@/lib/portfolio/valuation"

const quote: QuoteForCheck = {
  lastPrice: 4212,
  previousClose: 4000,
  week52High: 4212,
  week52Low: 3100,
}

describe("ruleMet", () => {
  it("checks targets, stop-losses and daily moves", () => {
    expect(
      ruleMet(
        { kind: "price_above", threshold: 4200, lastTriggeredAt: null },
        quote,
      ),
    ).toBe(true)
    expect(
      ruleMet(
        { kind: "price_above", threshold: 4300, lastTriggeredAt: null },
        quote,
      ),
    ).toBe(false)
    expect(
      ruleMet(
        { kind: "price_below", threshold: 4212, lastTriggeredAt: null },
        quote,
      ),
    ).toBe(true)
    // +5.3% today.
    expect(
      ruleMet({ kind: "day_move", threshold: 5, lastTriggeredAt: null }, quote),
    ).toBe(true)
    expect(
      ruleMet(
        { kind: "day_move", threshold: 5, lastTriggeredAt: null },
        { ...quote, lastPrice: 3790 },
      ),
    ).toBe(true)
    expect(
      ruleMet(
        { kind: "day_move", threshold: 5, lastTriggeredAt: null },
        { ...quote, previousClose: null },
      ),
    ).toBe(false)
  })

  it("checks 52-week highs and lows only when known", () => {
    expect(
      ruleMet(
        { kind: "high_52w", threshold: null, lastTriggeredAt: null },
        quote,
      ),
    ).toBe(true)
    expect(
      ruleMet(
        { kind: "low_52w", threshold: null, lastTriggeredAt: null },
        quote,
      ),
    ).toBe(false)
    expect(
      ruleMet(
        { kind: "high_52w", threshold: null, lastTriggeredAt: null },
        { ...quote, week52High: null },
      ),
    ).toBe(false)
  })
})

describe("firedToday and isQuietHours", () => {
  it("allows one alert per India date", () => {
    const now = new Date("2026-09-21T05:00:00Z") // 10:30 India time
    expect(firedToday("2026-09-20T20:00:00Z", now)).toBe(true) // 1:30 AM on the 21st in India
    expect(firedToday("2026-09-20T18:00:00Z", now)).toBe(false) // 11:30 PM on the 20th
    expect(firedToday(null, now)).toBe(false)
  })

  it("handles quiet hours across midnight", () => {
    const at = (utc: string) => new Date(`2026-09-21T${utc}:00Z`)
    expect(isQuietHours(at("17:00"), "22:00", "07:00")).toBe(true) // 10:30 PM
    expect(isQuietHours(at("00:00"), "22:00", "07:00")).toBe(true) // 5:30 AM
    expect(isQuietHours(at("05:00"), "22:00", "07:00")).toBe(false) // 10:30 AM
    expect(isQuietHours(at("05:00"), "10:00", "11:00")).toBe(true)
    expect(isQuietHours(at("05:00"), "07:00", "07:00")).toBe(false)
  })
})

describe("messages", () => {
  it("describes rules and writes alert messages with holders", () => {
    expect(describeRule({ kind: "price_below", threshold: 180 })).toBe(
      "Below ₹180.00",
    )
    expect(describeRule({ kind: "day_move", threshold: 4 })).toBe(
      "Moves 4.00% in a day",
    )
    expect(
      priceAlertMessage({
        rule: { kind: "price_above", threshold: 4200 },
        symbol: "TCS",
        quote,
        holders: [
          { name: "Dad", quantity: 20 },
          { name: "Me <3", quantity: 5 },
        ],
        note: null,
      }),
    ).toBe(
      "🎯 <b>TCS</b> is at ₹4,212.00, above your ₹4,200.00 target.\nHeld by Dad 20, Me &lt;3 5 (₹1,05,300).",
    )
  })

  it("summarises the family and members at the close", () => {
    const summary = summarize([])
    const message = dailySummaryMessage({
      now: new Date("2026-09-21T10:30:00Z"),
      family: {
        ...summary,
        currentValue: 2_460_000,
        dayChange: 12_340,
        dayChangePct: 0.5,
      },
      members: [
        {
          name: "Dad",
          summary: {
            ...summary,
            holdingCount: 3,
            currentValue: 1_120_000,
            dayChangePct: 0.8,
          },
        },
        { name: "Nobody", summary },
      ],
      movers: {
        gainers: [
          { instrumentId: 1, lastPrice: 1, changePct: 4.1, dayChange: 1 },
        ],
        losers: [],
      },
      symbolOf: () => "TATAMOTORS",
    })
    expect(message).toContain("Market close, 21 Sept")
    expect(message).toContain("Family: <b>₹24.6L</b> (+₹12,340, +0.50% today)")
    expect(message).toContain("Dad: ₹11.2L +0.80%")
    expect(message).not.toContain("Nobody")
    expect(message).toContain("🟢 Top gainer: TATAMOTORS +4.10%")
  })
})
