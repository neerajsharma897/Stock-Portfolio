import { describe, expect, it } from "vitest"

import { normalizeSearchQuery, rankInstruments } from "@/lib/instruments/search"

describe("normalizeSearchQuery", () => {
  it("uppercases and removes characters that aren't in tickers", () => {
    expect(normalizeSearchQuery("tata motors")).toBe("TATAMOTORS")
    expect(normalizeSearchQuery(" m&m ")).toBe("M&M")
    expect(normalizeSearchQuery("bajaj-auto")).toBe("BAJAJ-AUTO")
    expect(normalizeSearchQuery("tcs%,()*")).toBe("TCS")
  })
})

describe("rankInstruments", () => {
  const item = (symbol: string, exchange: "NSE" | "BSE", name = symbol) => ({
    symbol,
    exchange,
    name,
  })

  it("puts exact matches first, NSE before BSE", () => {
    const ranked = rankInstruments(
      [
        item("TCSFOODS", "NSE"),
        item("TCS", "BSE"),
        item("TCS", "NSE"),
        item("ALLTCS", "NSE"),
      ],
      "TCS",
      10,
    )
    expect(ranked.map((i) => `${i.symbol}:${i.exchange}`)).toEqual([
      "TCS:NSE",
      "TCS:BSE",
      "TCSFOODS:NSE",
      "ALLTCS:NSE",
    ])
  })

  it("limits the number of results", () => {
    const items = ["AA", "AB", "AC"].map((s) => item(s, "NSE"))
    expect(rankInstruments(items, "A", 2)).toHaveLength(2)
  })
})
