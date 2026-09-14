import { describe, expect, it } from "vitest"

import { DEFAULT_AFTER_LOGIN, safeRedirectPath } from "@/lib/redirect"

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/members")).toBe("/members")
    expect(safeRedirectPath("/members/abc?tab=stocks")).toBe(
      "/members/abc?tab=stocks",
    )
  })

  it("rejects external and protocol-relative URLs", () => {
    expect(safeRedirectPath("https://evil.com")).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeRedirectPath("//evil.com")).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeRedirectPath("/\\evil.com")).toBe(DEFAULT_AFTER_LOGIN)
  })

  it("rejects paths that browsers turn into another website", () => {
    expect(safeRedirectPath("/\t/evil.com")).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeRedirectPath("/\n/evil.com")).toBe(DEFAULT_AFTER_LOGIN)
  })

  it("falls back for missing values and the login page itself", () => {
    expect(safeRedirectPath(null)).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeRedirectPath("")).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeRedirectPath("/login")).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeRedirectPath("/login?next=/members")).toBe(DEFAULT_AFTER_LOGIN)
    expect(safeRedirectPath("/members/../login")).toBe(DEFAULT_AFTER_LOGIN)
  })
})
