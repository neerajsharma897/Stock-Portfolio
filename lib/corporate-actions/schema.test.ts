import { describe, expect, it } from "vitest"

import {
  corporateActionSchema,
  describeCorporateAction,
} from "@/lib/corporate-actions/schema"

const valid = {
  instrumentId: "2885",
  kind: "split",
  ratioFrom: "1",
  ratioTo: "5",
  exDate: "2024-06-03",
  notes: "",
}

describe("corporateActionSchema", () => {
  it("reads a split", () => {
    expect(corporateActionSchema.parse(valid)).toEqual({
      instrumentId: 2885,
      kind: "split",
      ratioFrom: 1,
      ratioTo: 5,
      exDate: "2024-06-03",
      notes: null,
    })
  })

  it("rejects a split that changes nothing, but allows a 1 for 1 bonus", () => {
    const same = corporateActionSchema.safeParse({ ...valid, ratioTo: "1" })
    expect(same.success).toBe(false)
    expect(same.error?.issues[0].path).toEqual(["ratioTo"])
    expect(
      corporateActionSchema.safeParse({ ...valid, kind: "bonus", ratioTo: "1" })
        .success,
    ).toBe(true)
  })

  it("rejects fractions and far-future dates", () => {
    expect(
      corporateActionSchema.safeParse({ ...valid, ratioTo: "2.5" }).success,
    ).toBe(false)
    expect(
      corporateActionSchema.safeParse({ ...valid, exDate: "2099-01-01" })
        .success,
    ).toBe(false)
  })
})

describe("describeCorporateAction", () => {
  it("says what happens to the shares", () => {
    expect(
      describeCorporateAction({ kind: "split", ratioFrom: 1, ratioTo: 5 }),
    ).toBe("Split 1 → 5")
    expect(
      describeCorporateAction({ kind: "bonus", ratioFrom: 2, ratioTo: 1 }),
    ).toBe("Bonus 1 for every 2 held")
  })
})
