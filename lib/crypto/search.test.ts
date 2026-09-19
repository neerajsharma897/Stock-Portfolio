import { describe, expect, it } from "vitest"

import { normalizeCoinQuery, rankCoins } from "@/lib/crypto/search"

describe("normalizeCoinQuery", () => {
  it("keeps letters, digits and single spaces", () => {
    expect(normalizeCoinQuery("  Shiba_Inu%, ")).toBe("Shiba Inu")
    expect(normalizeCoinQuery("%_,()")).toBe("")
  })
})

describe("rankCoins", () => {
  it("puts exact symbols and names ahead of prefixes, then shorter symbols", () => {
    const coins = [
      { symbol: "WBTC", name: "Wrapped Bitcoin" },
      { symbol: "BTCST", name: "BTC Standard Hashrate" },
      { symbol: "BCH", name: "Bitcoin Cash" },
      { symbol: "BTC", name: "Bitcoin" },
    ]
    expect(rankCoins(coins, "btc", 10).map((coin) => coin.symbol)).toEqual([
      "BTC",
      "BTCST",
      "BCH",
      "WBTC",
    ])
    expect(rankCoins(coins, "bitcoin", 2).map((coin) => coin.symbol)).toEqual([
      "BTC",
      "BCH",
    ])
  })
})
