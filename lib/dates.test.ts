import { describe, expect, it } from "vitest"

import { isValidIsoDate, todayInIndia } from "@/lib/dates"

describe("todayInIndia", () => {
  it("uses the Indian date, which can be a day ahead of UTC", () => {
    expect(todayInIndia(new Date("2026-09-13T20:00:00Z"))).toBe("2026-09-14")
    expect(todayInIndia(new Date("2026-09-13T10:00:00Z"))).toBe("2026-09-13")
  })
})

describe("isValidIsoDate", () => {
  it("accepts real dates only", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true)
    expect(isValidIsoDate("2023-02-29")).toBe(false)
    expect(isValidIsoDate("2024-13-01")).toBe(false)
    expect(isValidIsoDate("14/09/2026")).toBe(false)
  })
})
