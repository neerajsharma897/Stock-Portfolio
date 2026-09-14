import { describe, expect, it } from "vitest"

import { isAuthorizedCronRequest } from "@/lib/cron"

const SECRET = "3f9a1c7e5b2d8f4a6c0e9b1d7a3f5c2e"

describe("isAuthorizedCronRequest", () => {
  it("accepts the exact Bearer header Vercel sends", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true)
  })

  it("rejects missing, wrong or differently formatted headers", () => {
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false)
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false)
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}x`, SECRET)).toBe(false)
    expect(isAuthorizedCronRequest(`Bearer ${"0".repeat(32)}`, SECRET)).toBe(
      false,
    )
  })

  it("refuses every request when the secret is missing or too short", () => {
    expect(isAuthorizedCronRequest("Bearer ", undefined)).toBe(false)
    expect(isAuthorizedCronRequest("Bearer short", "short")).toBe(false)
  })
})
