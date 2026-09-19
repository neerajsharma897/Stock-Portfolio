import { z } from "zod"

import { isValidIsoDate, todayInIndia } from "@/lib/dates"
import {
  FD_INTERESTS,
  IPO_STATUSES,
  OTHER_ASSET_KINDS,
} from "@/lib/other-assets/options"
import { decimal, isBlank } from "@/lib/transactions/schema"

const notes = z.preprocess(
  (value) => (isBlank(value) ? null : value),
  z.string().trim().max(500, "Keep notes under 500 characters").nullable(),
)

const date = (label: string) =>
  z.string(`Enter the ${label}`).refine(isValidIsoDate, "Enter a valid date")

const pastDate = (label: string) =>
  date(label).refine(
    (value) => value <= todayInIndia(),
    "The date can't be in the future",
  )

const text = (label: string, example: string, max: number) =>
  z
    .string(`Enter the ${label}`)
    .trim()
    .min(1, `Enter the ${label}, e.g. ${example}`)
    .max(max, `Keep the ${label} under ${max} characters`)

export const depositSchema = z
  .object({
    bank: text("bank", "SBI", 60),
    principal: decimal("amount", 2),
    ratePct: decimal("interest rate", 3).refine(
      (rate) => rate < 50,
      "Enter the yearly rate, e.g. 7.1",
    ),
    interest: z.enum(FD_INTERESTS, "Choose how interest is paid"),
    startDate: pastDate("start date"),
    maturityDate: date("maturity date"),
    closedOn: z.preprocess(
      (value) => (isBlank(value) ? null : value),
      pastDate("closing date").nullable(),
    ),
    notes,
  })
  .refine((deposit) => deposit.maturityDate > deposit.startDate, {
    path: ["maturityDate"],
    message: "The maturity date must be after the start date",
  })
  .refine(
    (deposit) => !deposit.closedOn || deposit.closedOn >= deposit.startDate,
    { path: ["closedOn"], message: "It can't close before it starts" },
  )

export const otherAssetSchema = z.object({
  kind: z.enum(OTHER_ASSET_KINDS, "Choose a type"),
  name: text("name", "SBI PPF", 80),
  invested: decimal("amount invested", 2, { allowZero: true }),
  currentValue: decimal("current value", 2, { allowZero: true }),
  valueAsOf: pastDate("valuation date"),
  notes,
})

export const ipoSchema = z
  .object({
    company: text("company", "Tata Technologies", 80),
    appliedOn: pastDate("application date"),
    sharesApplied: z.coerce
      .number("Enter the shares applied for")
      .int("Enter whole shares")
      .positive("Enter the shares applied for"),
    price: decimal("price", 2),
    status: z.enum(IPO_STATUSES, "Choose a status"),
    sharesAllotted: z.preprocess(
      (value) => (isBlank(value) ? null : value),
      z.coerce
        .number("Enter the shares allotted")
        .int("Enter whole shares")
        .min(0, "Enter the shares allotted")
        .nullable(),
    ),
    notes,
  })
  .refine(
    (ipo) =>
      ipo.status !== "allotted" ||
      (ipo.sharesAllotted !== null && ipo.sharesAllotted > 0),
    { path: ["sharesAllotted"], message: "Enter the shares allotted" },
  )
