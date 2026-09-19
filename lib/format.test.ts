import { describe, expect, it } from "vitest"

import {
  formatCompactINR,
  formatDate,
  formatINR,
  formatPercent,
  formatPriceINR,
  formatSignedINR,
} from "@/lib/format"

describe("formatINR", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(123456.789)).toBe("₹1,23,456.79")
    expect(formatINR(12345678)).toBe("₹1,23,45,678.00")
  })

  it("puts the minus sign before the rupee symbol", () => {
    expect(formatINR(-1234.5)).toBe("−₹1,234.50")
  })

  it("never shows a negative zero", () => {
    expect(formatINR(-0.001)).toBe("₹0.00")
  })

  it("supports whole-rupee output", () => {
    expect(formatINR(12340.4, 0)).toBe("₹12,340")
  })
})

describe("formatSignedINR", () => {
  it("adds + for gains only", () => {
    expect(formatSignedINR(12340)).toBe("+₹12,340.00")
    expect(formatSignedINR(-500)).toBe("−₹500.00")
    expect(formatSignedINR(0)).toBe("₹0.00")
  })
})

describe("formatPriceINR", () => {
  it("shows paise for prices of a rupee or more", () => {
    expect(formatPriceINR(7720121.2)).toBe("₹77,20,121.20")
    expect(formatPriceINR(1)).toBe("₹1.00")
  })

  it("keeps significant digits for tiny coin prices", () => {
    expect(formatPriceINR(0.0005154)).toBe("₹0.0005154")
    expect(formatPriceINR(0.5)).toBe("₹0.50")
    expect(formatPriceINR(0.000000632612)).toBe("₹0.0000006326")
  })
})

describe("formatCompactINR", () => {
  it("uses lakh and crore", () => {
    expect(formatCompactINR(2460000)).toBe("₹24.6L")
    expect(formatCompactINR(12500000)).toBe("₹1.25Cr")
    expect(formatCompactINR(100000)).toBe("₹1L")
    expect(formatCompactINR(-250000)).toBe("−₹2.5L")
  })

  it("shows full rupees below one lakh", () => {
    expect(formatCompactINR(12340)).toBe("₹12,340")
    expect(formatCompactINR(-0.4)).toBe("₹0")
  })

  it("moves to the next unit when rounding reaches it", () => {
    expect(formatCompactINR(99999.6)).toBe("₹1L")
    expect(formatCompactINR(9999999)).toBe("₹1Cr")
  })
})

describe("formatPercent", () => {
  it("signs changes by default", () => {
    expect(formatPercent(0.5)).toBe("+0.50%")
    expect(formatPercent(-2.3)).toBe("−2.30%")
    expect(formatPercent(0)).toBe("0.00%")
  })

  it("can drop the + sign", () => {
    expect(formatPercent(38, { decimals: 0, signed: false })).toBe("38%")
  })
})

describe("formatDate", () => {
  it("formats in IST", () => {
    // 20:00 UTC on 13 Sep is already 14 Sep in India.
    expect(formatDate("2026-09-13T20:00:00Z")).toMatch(/^14 Sept? 2026$/)
  })
})
