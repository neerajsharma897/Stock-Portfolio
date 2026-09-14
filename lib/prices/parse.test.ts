import { describe, expect, it } from "vitest"

import { parsePriceInput } from "@/lib/prices/parse"

describe("parsePriceInput", () => {
  it("reads typed prices, allowing commas", () => {
    expect(parsePriceInput("1,250.50")).toEqual({ ok: true, value: 1250.5 })
    expect(parsePriceInput(" 42 ")).toEqual({ ok: true, value: 42 })
  })

  it("treats blank and missing as no price", () => {
    expect(parsePriceInput("")).toEqual({ ok: true, value: null })
    expect(parsePriceInput(null)).toEqual({ ok: true, value: null })
  })

  it("rejects zero, negatives, text and too many decimals", () => {
    for (const input of ["0", "-5", "abc", "10.12345", "1e3"]) {
      expect(parsePriceInput(input).ok).toBe(false)
    }
  })
})
