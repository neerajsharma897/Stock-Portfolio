import { describe, expect, it } from "vitest"

import { parseInstrument, parseScripMaster } from "@/lib/instruments/parse"

// Shapes copied from the real OpenAPIScripMaster.json (September 2026).
const base = {
  expiry: "",
  strike: "-1.000000",
  lotsize: "1",
  instrumenttype: "",
  freeze_qty: "0",
  is_cas_enabled: true,
}
const relianceNse = {
  ...base,
  token: "2885",
  symbol: "RELIANCE-EQ",
  name: "RELIANCE",
  exch_seg: "NSE",
  tick_size: "10.000000",
}
const relianceBse = {
  ...base,
  token: "500325",
  symbol: "RELIANCE",
  name: "RELIANCE",
  exch_seg: "BSE",
  tick_size: "5.000000",
}

describe("parseInstrument", () => {
  it("keeps NSE shares and strips the series from the symbol", () => {
    expect(parseInstrument(relianceNse)).toEqual({
      exchange: "NSE",
      token: "2885",
      trading_symbol: "RELIANCE-EQ",
      symbol: "RELIANCE",
      name: "RELIANCE",
      series: "EQ",
      kind: "equity",
      tick_size: 0.1,
    })
  })

  it("keeps hyphens that are part of the symbol", () => {
    expect(
      parseInstrument({
        ...relianceNse,
        token: "16669",
        symbol: "BAJAJ-AUTO-EQ",
        name: "BAJAJ-AUTO",
      }),
    ).toMatchObject({ symbol: "BAJAJ-AUTO", series: "EQ" })
  })

  it("keeps BSE shares in the share code range", () => {
    expect(parseInstrument(relianceBse)).toMatchObject({
      exchange: "BSE",
      symbol: "RELIANCE",
      series: null,
      kind: "equity",
      tick_size: 0.05,
    })
  })

  it("marks NSE gold bonds and indices", () => {
    expect(
      parseInstrument({
        ...relianceNse,
        token: "17110",
        symbol: "SGBJ28VIII-GB",
        name: "SGBJ28VIII",
        tick_size: "1.000000",
      }),
    ).toMatchObject({ kind: "sgb", symbol: "SGBJ28VIII", series: "GB" })

    expect(
      parseInstrument({
        ...base,
        token: "99926000",
        symbol: "Nifty 50",
        name: "NIFTY",
        instrumenttype: "AMXIDX",
        exch_seg: "NSE",
        tick_size: "0.000000",
      }),
    ).toMatchObject({ kind: "index", symbol: "Nifty 50" })
  })

  it("skips derivatives, other markets, debt series and BSE bonds", () => {
    const skipped = [
      { ...relianceNse, instrumenttype: "OPTSTK", exch_seg: "NFO" },
      { ...relianceNse, exch_seg: "MCX" },
      { ...relianceNse, symbol: "KA35-SG" },
      { ...relianceNse, symbol: "GS2030-GS" },
      { ...relianceBse, token: "974512", symbol: "845HDFC28" },
      { ...relianceNse, token: "abc" },
    ]
    for (const record of skipped) expect(parseInstrument(record)).toBeNull()
  })
})

describe("parseScripMaster", () => {
  it("parses a list, ignoring junk and duplicates", () => {
    const rows = parseScripMaster([
      relianceNse,
      relianceBse,
      relianceNse,
      null,
      "junk",
    ])
    expect(rows.map((row) => `${row.exchange}:${row.symbol}`)).toEqual([
      "NSE:RELIANCE",
      "BSE:RELIANCE",
    ])
  })

  it("rejects a file that isn't a list", () => {
    expect(() => parseScripMaster({ error: "null" })).toThrow("expected format")
  })
})
