import { describe, expect, it } from "vitest"

import {
  buildQuoteBatches,
  MAX_TOKENS_PER_REQUEST,
  parseQuotes,
  type QuoteRequestItem,
} from "@/lib/angelone/quotes"

describe("buildQuoteBatches", () => {
  it("groups tokens by exchange in FULL mode", () => {
    expect(
      buildQuoteBatches([
        { exchange: "NSE", token: "2885" },
        { exchange: "BSE", token: "500325" },
        { exchange: "NSE", token: "11536" },
      ]),
    ).toEqual([
      {
        mode: "FULL",
        exchangeTokens: { NSE: ["2885", "11536"], BSE: ["500325"] },
      },
    ])
  })

  it("splits into batches of at most 50 tokens and drops duplicates", () => {
    const items: QuoteRequestItem[] = Array.from({ length: 120 }, (_, i) => ({
      exchange: i % 2 === 0 ? "NSE" : "BSE",
      token: String(1000 + i),
    }))
    const batches = buildQuoteBatches([...items, items[0], items[1]])
    const sizes = batches.map((batch) =>
      Object.values(batch.exchangeTokens).reduce(
        (sum, tokens) => sum + (tokens?.length ?? 0),
        0,
      ),
    )
    expect(sizes).toEqual([MAX_TOKENS_PER_REQUEST, MAX_TOKENS_PER_REQUEST, 20])
  })

  it("returns no batches for no instruments", () => {
    expect(buildQuoteBatches([])).toEqual([])
  })
})

describe("parseQuotes", () => {
  it("reads the documented FULL-mode response", () => {
    // Trimmed from the sample in Angel One's Market Data API docs.
    const data = {
      fetched: [
        {
          exchange: "NSE",
          tradingSymbol: "SBIN-EQ",
          symbolToken: "3045",
          ltp: 568.2,
          open: 567.4,
          high: 569.35,
          low: 566.1,
          close: 567.4,
          netChange: 0.8,
          percentChange: 0.14,
          "52WeekLow": 430.4,
          "52WeekHigh": 629.55,
        },
      ],
      unfetched: [],
    }
    expect(parseQuotes(data)).toEqual([
      {
        exchange: "NSE",
        token: "3045",
        lastPrice: 568.2,
        previousClose: 567.4,
        week52High: 629.55,
        week52Low: 430.4,
      },
    ])
  })

  it("skips entries without a usable price and tolerates a missing close", () => {
    expect(
      parseQuotes({
        fetched: [
          { exchange: "NSE", symbolToken: "1", ltp: 0, close: 10 },
          { exchange: "NFO", symbolToken: "2", ltp: 10, close: 10 },
          { exchange: "BSE", symbolToken: "500325", ltp: "1400.5" },
          null,
        ],
      }),
    ).toEqual([
      {
        exchange: "BSE",
        token: "500325",
        lastPrice: 1400.5,
        week52High: null,
        week52Low: null,
        previousClose: null,
      },
    ])
  })

  it("returns nothing for unexpected shapes", () => {
    expect(parseQuotes(null)).toEqual([])
    expect(parseQuotes({ fetched: "nope" })).toEqual([])
  })
})
