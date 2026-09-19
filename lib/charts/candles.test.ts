import { describe, expect, it } from "vitest"

import {
  candleRequestDates,
  isChartRange,
  lastSession,
  liveBucket,
  parseCandles,
  rangeChange,
} from "@/lib/charts/candles"

// Rows in SmartAPI's getCandleData format.
const ROWS = [
  ["2026-09-14T15:25:00+05:30", 1401, 1403, 1400, 1402.5, 12000],
  ["2026-09-15T09:20:00+05:30", 1410, 1415, 1408, 1414, 9000],
  ["2026-09-15T09:15:00+05:30", 1405, 1412, 1404, 1410, 15000],
  ["2026-09-15T09:25:00+05:30", 0, 1416, 1413, 1415, 100],
  ["not a date", 1, 2, 3, 4, 5],
  "junk",
]

describe("candleRequestDates", () => {
  it("counts back from now in India time", () => {
    // 06:25 UTC is 11:55 in India.
    const now = new Date("2026-09-15T06:25:49Z")
    expect(candleRequestDates("1W", now)).toEqual({
      fromdate: "2026-09-08 00:00",
      todate: "2026-09-15 11:55",
    })
    expect(candleRequestDates("5Y", now).fromdate).toBe("2021-09-15 00:00")
  })

  it("uses the India date just after midnight UTC+5:30", () => {
    expect(
      candleRequestDates("1D", new Date("2026-09-14T19:00:00Z")).todate,
    ).toBe("2026-09-15 00:30")
  })
})

describe("parseCandles and lastSession", () => {
  it("keeps valid rows, oldest first", () => {
    const candles = parseCandles(ROWS)
    expect(candles.map((candle) => candle.close)).toEqual([1402.5, 1410, 1414])
    expect(candles[1]).toEqual({
      time: Date.parse("2026-09-15T03:45:00Z") / 1000,
      open: 1405,
      high: 1412,
      low: 1404,
      close: 1410,
    })
    expect(parseCandles({ message: "error" })).toEqual([])
  })

  it("keeps only the latest trading day", () => {
    expect(lastSession(parseCandles(ROWS))).toHaveLength(2)
    expect(lastSession([])).toEqual([])
  })
})

describe("liveBucket, rangeChange and isChartRange", () => {
  it("places a live price in its 5-minute candle", () => {
    expect(liveBucket("2026-09-15T03:49:59.500Z")).toBe(
      Date.parse("2026-09-15T03:45:00Z") / 1000,
    )
  })

  it("measures a day from the previous close and longer ranges from the first candle", () => {
    const candles = parseCandles(ROWS)
    expect(rangeChange(candles, "1D", 1400, 1421)).toEqual({
      last: 1421,
      change: 21,
      changePct: 1.5,
    })
    expect(rangeChange(candles, "1M", 1400)?.change).toBe(1414 - 1401)
    expect(rangeChange([], "1D", 1400)).toBeNull()
  })

  it("accepts only known ranges", () => {
    expect(isChartRange("6M")).toBe(true)
    expect(isChartRange("2D")).toBe(false)
  })
})
