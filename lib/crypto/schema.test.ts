import { describe, expect, it } from "vitest"

import { cryptoTransactionSchema } from "@/lib/crypto/schema"

const valid = {
  type: "buy",
  brokerAccountId: "4a2d3b5f-6c7e-4f80-9bac-1d2e3f4a5b6c",
  market: "SHIBINR",
  tradeDate: "2026-09-01",
  quantity: "2,500,000",
  price: "0.0005154",
  charges: "",
  notes: "",
}

describe("cryptoTransactionSchema", () => {
  it("accepts small coin prices and large quantities", () => {
    expect(cryptoTransactionSchema.parse(valid)).toEqual({
      type: "buy",
      brokerAccountId: valid.brokerAccountId,
      market: "SHIBINR",
      tradeDate: "2026-09-01",
      quantity: 2_500_000,
      price: 0.0005154,
      charges: 0,
      notes: null,
    })
  })

  it("rejects unknown markets and too many decimals", () => {
    const result = cryptoTransactionSchema.safeParse({
      ...valid,
      market: "BTCUSDT",
      quantity: "0.123456789",
    })
    expect(result.success).toBe(false)
    const fields = result.error!.issues.map((issue) => issue.path[0])
    expect(fields).toEqual(["market", "quantity"])
  })
})
