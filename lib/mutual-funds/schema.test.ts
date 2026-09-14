import { describe, expect, it } from "vitest"

import { mfTransactionSchema } from "@/lib/mutual-funds/schema"
import { toHoldingType } from "@/lib/mutual-funds/options"

const valid = {
  type: "sip",
  brokerAccountId: "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
  amfiCode: "122639",
  folioNumber: " 12345678/90 ",
  tradeDate: "2026-09-05",
  units: "55.8231",
  nav: "89.5712",
  charges: "",
  notes: "",
}

function errorPaths(input: Record<string, unknown>) {
  const result = mfTransactionSchema.safeParse(input)
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."))
}

describe("mfTransactionSchema", () => {
  it("parses a SIP instalment", () => {
    expect(mfTransactionSchema.parse(valid)).toEqual({
      type: "sip",
      brokerAccountId: valid.brokerAccountId,
      amfiCode: 122639,
      folioNumber: "12345678/90",
      tradeDate: "2026-09-05",
      units: 55.8231,
      nav: 89.5712,
      charges: 0,
      notes: null,
    })
  })

  it("requires a fund, account, units and NAV", () => {
    expect(
      errorPaths({
        ...valid,
        amfiCode: "",
        brokerAccountId: "",
        units: "0",
        nav: "",
      }),
    ).toEqual(
      expect.arrayContaining(["amfiCode", "brokerAccountId", "units", "nav"]),
    )
  })

  it("rejects more than 4 decimals of units or NAV", () => {
    expect(errorPaths({ ...valid, units: "1.23456" })).toContain("units")
    expect(errorPaths({ ...valid, nav: "10.12345" })).toContain("nav")
  })
})

describe("toHoldingType", () => {
  it("maps fund entries onto buys and sells", () => {
    expect(toHoldingType("opening_balance")).toBe("opening_balance")
    expect(toHoldingType("purchase")).toBe("buy")
    expect(toHoldingType("sip")).toBe("buy")
    expect(toHoldingType("redemption")).toBe("sell")
  })
})
