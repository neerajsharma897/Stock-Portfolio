import { describe, expect, it } from "vitest"

import { alertPreferencesSchema, alertRuleSchema } from "@/lib/alerts/schema"

describe("alertRuleSchema", () => {
  it("needs a price for targets and a percent for daily moves", () => {
    expect(
      alertRuleSchema.parse({
        instrumentId: "11536",
        kind: "price_above",
        threshold: "4,200",
        note: "",
      }),
    ).toEqual({
      instrumentId: 11536,
      kind: "price_above",
      threshold: 4200,
      note: null,
    })

    const missing = alertRuleSchema.safeParse({
      instrumentId: "11536",
      kind: "day_move",
      threshold: "",
    })
    expect(missing.error?.issues[0].path).toEqual(["threshold"])
    expect(
      alertRuleSchema.safeParse({
        instrumentId: "1",
        kind: "day_move",
        threshold: "150",
      }).success,
    ).toBe(false)
  })

  it("drops the value for 52-week alerts", () => {
    expect(
      alertRuleSchema.parse({
        instrumentId: "1",
        kind: "high_52w",
        threshold: "5",
      }),
    ).toMatchObject({ threshold: null })
  })
})

describe("alertPreferencesSchema", () => {
  it("reads checkboxes and times", () => {
    expect(
      alertPreferencesSchema.parse({
        dailySummary: "on",
        quietStart: "22:00",
        quietEnd: "07:00",
      }),
    ).toEqual({
      dailySummary: true,
      systemAlerts: false,
      quietStart: "22:00",
      quietEnd: "07:00",
    })
    expect(
      alertPreferencesSchema.safeParse({
        quietStart: "25:00",
        quietEnd: "07:00",
      }).success,
    ).toBe(false)
  })
})
