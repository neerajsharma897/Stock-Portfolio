import { describe, expect, it } from "vitest"

import { brokerAccountSchema, memberSchema } from "@/lib/members/schema"

function fieldErrors(result: {
  success: boolean
  error?: { issues: { path: PropertyKey[] }[] }
}) {
  return result.error?.issues.map((issue) => issue.path.join(".")) ?? []
}

describe("memberSchema", () => {
  it("trims text, uppercases the PAN and turns blanks into null", () => {
    const result = memberSchema.parse({
      name: "  Neeraj  ",
      relation: "son",
      color: "#2563eb",
      panLast4: " 234f ",
      notes: "   ",
    })
    expect(result).toEqual({
      name: "Neeraj",
      relation: "son",
      color: "#2563eb",
      panLast4: "234F",
      notes: null,
    })
  })

  it("treats missing optional fields as null", () => {
    const result = memberSchema.parse({
      name: "Mom",
      relation: "spouse",
      color: "#15803d",
    })
    expect(result.panLast4).toBeNull()
    expect(result.notes).toBeNull()
  })

  it("rejects bad input with an error on each field", () => {
    const result = memberSchema.safeParse({
      name: " ",
      relation: "",
      color: "#000000",
      panLast4: "ABCDE1234F",
    })
    expect(result.success).toBe(false)
    expect(fieldErrors(result)).toEqual(
      expect.arrayContaining(["name", "relation", "color", "panLast4"]),
    )
  })

  it("only accepts a PAN ending in 3 digits and a letter", () => {
    const base = { name: "Dad", relation: "self", color: "#2563eb" }
    expect(memberSchema.safeParse({ ...base, panLast4: "1234" }).success).toBe(
      false,
    )
    expect(memberSchema.safeParse({ ...base, panLast4: "123A" }).success).toBe(
      true,
    )
  })
})

describe("brokerAccountSchema", () => {
  it("normalises optional fields", () => {
    expect(
      brokerAccountSchema.parse({
        broker: "zerodha",
        label: "",
        clientIdLast4: "ab12",
        notes: " Main account ",
      }),
    ).toEqual({
      broker: "zerodha",
      label: null,
      clientIdLast4: "AB12",
      notes: "Main account",
    })
  })

  it("rejects unknown brokers and long client IDs", () => {
    const result = brokerAccountSchema.safeParse({
      broker: "icici",
      clientIdLast4: "12345",
    })
    expect(fieldErrors(result)).toEqual(
      expect.arrayContaining(["broker", "clientIdLast4"]),
    )
  })
})
