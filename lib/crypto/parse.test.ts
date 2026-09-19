import { describe, expect, it } from "vitest"

import { parseCoinMarkets, parseTicker } from "@/lib/crypto/parse"

// Trimmed entries from the real endpoints (September 2026).
const MARKETS = [
  {
    coindcx_name: "BTCINR",
    base_currency_short_name: "INR",
    target_currency_short_name: "BTC",
    target_currency_name: "Bitcoin",
    symbol: "BTCINR",
    pair: "I-BTC_INR",
    status: "active",
  },
  {
    coindcx_name: "SHIBINR",
    base_currency_short_name: "INR",
    target_currency_short_name: "SHIB",
    target_currency_name: "SHIBA INU",
    symbol: "SHIBINR",
    pair: "I-SHIB_INR",
    status: "active",
  },
  {
    coindcx_name: "BTCUSDT",
    base_currency_short_name: "USDT",
    target_currency_short_name: "BTC",
    target_currency_name: "Bitcoin",
    symbol: "BTCUSDT",
    pair: "B-BTC_USDT",
    status: "active",
  },
  {
    coindcx_name: "OLDINR",
    base_currency_short_name: "INR",
    target_currency_short_name: "OLD",
    target_currency_name: "Old Coin",
    symbol: "OLDINR",
    status: "inactive",
  },
]

const TICKER = [
  {
    market: "BTCINR",
    change_24_hour: "-0.5664391163632731",
    high: "7898786",
    low: "7650000",
    volume: "34199965.0924638",
    last_price: "7720121.2000000000",
    bid: "7679938.8000000000",
    ask: "7722638.2000000000",
    timestamp: 1789453549,
  },
  {
    market: "SHIBINR",
    change_24_hour: "-2.0152091254752852",
    last_price: "0.0005154000",
    timestamp: 1789453549,
  },
  {
    market: "B-BTC_USDT",
    change_24_hour: "-0.51",
    last_price: "88000.1",
    timestamp: 1789453549,
  },
  { market: "DEADINR", change_24_hour: "", last_price: "0", timestamp: 1 },
  { market: "NOCHANGEINR", last_price: "12.5", timestamp: 1789453549 },
]

describe("parseCoinMarkets", () => {
  it("keeps active rupee markets with their names", () => {
    expect(parseCoinMarkets(MARKETS)).toEqual([
      { market: "BTCINR", symbol: "BTC", name: "Bitcoin" },
      { market: "SHIBINR", symbol: "SHIB", name: "SHIBA INU" },
    ])
  })

  it("rejects a response that isn't a list", () => {
    expect(() => parseCoinMarkets({ message: "rate limited" })).toThrow(
      "isn't in the expected format",
    )
  })
})

describe("parseTicker", () => {
  it("reads rupee prices, the 24-hour change and the price time", () => {
    const quotes = parseTicker(TICKER)
    expect([...quotes.keys()]).toEqual(["BTCINR", "SHIBINR", "NOCHANGEINR"])
    expect(quotes.get("BTCINR")).toEqual({
      market: "BTCINR",
      lastPrice: 7720121.2,
      change24hPct: -0.5664,
      pricedAt: "2026-09-15T06:25:49.000Z",
    })
    expect(quotes.get("SHIBINR")?.lastPrice).toBe(0.0005154)
    expect(quotes.get("NOCHANGEINR")?.change24hPct).toBeNull()
  })
})
