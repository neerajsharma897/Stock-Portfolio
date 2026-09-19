import { describe, expect, it } from "vitest"

import {
  depositSchema,
  ipoSchema,
  otherAssetSchema,
} from "@/lib/other-assets/schema"

describe("depositSchema", () => {
  const valid = {
    bank: " SBI ",
    principal: "1,00,000",
    ratePct: "7.1",
    interest: "quarterly",
    startDate: "2025-01-01",
    maturityDate: "2027-01-01",
    closedOn: "",
    notes: "",
  }

  it("reads an FD", () => {
    expect(depositSchema.parse(valid)).toEqual({
      bank: "SBI",
      principal: 100_000,
      ratePct: 7.1,
      interest: "quarterly",
      startDate: "2025-01-01",
      maturityDate: "2027-01-01",
      closedOn: null,
      notes: null,
    })
  })

  it("checks the dates and rate", () => {
    const result = depositSchema.safeParse({
      ...valid,
      maturityDate: "2024-12-01",
      ratePct: "71",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path[0])).toContain(
      "ratePct",
    )
    expect(
      depositSchema.safeParse({ ...valid, maturityDate: "2024-12-01" }).error
        ?.issues[0].path,
    ).toEqual(["maturityDate"])
  })
})

describe("otherAssetSchema", () => {
  it("allows a zero invested amount, e.g. inherited gold", () => {
    expect(
      otherAssetSchema.parse({
        kind: "gold",
        name: "Gold coins",
        invested: "0",
        currentValue: "1,40,000",
        valueAsOf: "2026-09-01",
        notes: "",
      }),
    ).toMatchObject({ invested: 0, currentValue: 140_000 })
  })
})

describe("ipoSchema", () => {
  const valid = {
    company: "Tata Technologies",
    appliedOn: "2026-09-01",
    sharesApplied: "30",
    price: "500",
    status: "applied",
    sharesAllotted: "",
    notes: "",
  }

  it("reads an application", () => {
    expect(ipoSchema.parse(valid)).toMatchObject({
      sharesApplied: 30,
      price: 500,
      sharesAllotted: null,
    })
  })

  it("needs the allotted shares once allotted", () => {
    const result = ipoSchema.safeParse({ ...valid, status: "allotted" })
    expect(result.error?.issues[0].path).toEqual(["sharesAllotted"])
    expect(
      ipoSchema.safeParse({
        ...valid,
        status: "allotted",
        sharesAllotted: "30",
      }).success,
    ).toBe(true)
  })
})
