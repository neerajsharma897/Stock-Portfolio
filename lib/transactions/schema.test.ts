import { describe, expect, it } from "vitest"

import { todayInIndia } from "@/lib/dates"
import { transactionSchema } from "@/lib/transactions/schema"

const valid = {
  type: "buy",
  brokerAccountId: "3f1c2a4e-5b6d-4e7f-8a9b-0c1d2e3f4a5b",
  instrumentId: "42",
  tradeDate: "2026-01-15",
  quantity: "1,250",
  price: "2,845.50",
  charges: "20.36",
  notes: "",
}

function errorPaths(input: Record<string, unknown>) {
  const result = transactionSchema.safeParse(input)
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."))
}

describe("transactionSchema", () => {
  it("parses typed numbers with commas and turns blanks into defaults", () => {
    expect(transactionSchema.parse(valid)).toEqual({
      type: "buy",
      brokerAccountId: valid.brokerAccountId,
      instrumentId: 42,
      tradeDate: "2026-01-15",
      quantity: 1250,
      price: 2845.5,
      charges: 20.36,
      notes: null,
    })
  })

  it("treats missing charges as zero (opening balances have none)", () => {
    const { charges, ...withoutCharges } = valid
    void charges
    expect(
      transactionSchema.parse({ ...withoutCharges, type: "opening_balance" })
        .charges,
    ).toBe(0)
  })

  it("requires a stock, an account and positive amounts", () => {
    expect(
      errorPaths({
        ...valid,
        instrumentId: "",
        brokerAccountId: "",
        quantity: "0",
        price: "-5",
      }),
    ).toEqual(
      expect.arrayContaining([
        "instrumentId",
        "brokerAccountId",
        "quantity",
        "price",
      ]),
    )
  })

  it("rejects more decimals than the database stores", () => {
    expect(errorPaths({ ...valid, price: "10.12345" })).toContain("price")
    expect(errorPaths({ ...valid, charges: "1.234" })).toContain("charges")
    expect(errorPaths({ ...valid, quantity: "0.123456789" })).toContain(
      "quantity",
    )
  })

  it("rejects invalid and future dates", () => {
    expect(errorPaths({ ...valid, tradeDate: "2026-02-30" })).toContain(
      "tradeDate",
    )
    const [year, month, day] = todayInIndia().split("-").map(Number)
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1))
      .toISOString()
      .slice(0, 10)
    expect(errorPaths({ ...valid, tradeDate: tomorrow })).toContain("tradeDate")
  })
})
