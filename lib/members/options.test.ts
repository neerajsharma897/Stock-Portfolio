import { describe, expect, it } from "vitest"

import {
  brokerAccountName,
  MEMBER_COLOR_VALUES,
  memberInitials,
} from "@/lib/members/options"

describe("memberInitials", () => {
  it("uses the first letters of the first two words", () => {
    expect(memberInitials("Neeraj Sharma")).toBe("NS")
    expect(memberInitials("  mom ")).toBe("M")
    expect(memberInitials("a b c")).toBe("AB")
  })

  it("falls back to ? for blank names", () => {
    expect(memberInitials("   ")).toBe("?")
  })
})

describe("brokerAccountName", () => {
  it("adds the label only when there is one", () => {
    expect(brokerAccountName({ broker: "fivepaisa", label: null })).toBe(
      "5paisa",
    )
    expect(brokerAccountName({ broker: "zerodha", label: "Joint" })).toBe(
      "Zerodha · Joint",
    )
  })
})

describe("MEMBER_COLOR_VALUES", () => {
  it("matches the database check (lowercase 6-digit hex)", () => {
    for (const color of MEMBER_COLOR_VALUES) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
