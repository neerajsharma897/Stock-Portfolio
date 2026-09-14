import { z } from "zod"

import { isValidIsoDate, todayInIndia } from "@/lib/dates"
import { TRANSACTION_TYPES } from "@/lib/transactions/options"

// Stays within the database columns: numeric(20,8), numeric(18,4) and numeric(14,2).
const MAX_AMOUNT = 1e12

export function isBlank(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  )
}

/** A number typed by a person, e.g. "1,250.50", with at most `maxDecimals` decimals. */
export function decimal(
  label: string,
  maxDecimals: number,
  { allowZero = false } = {},
) {
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${maxDecimals}})?$`)
  return z.preprocess(
    (value) =>
      typeof value === "string" ? value.replace(/,/g, "").trim() : value,
    z
      .string(`Enter the ${label}`)
      .min(1, `Enter the ${label}`)
      .regex(
        pattern,
        `Enter the ${label} as a number (up to ${maxDecimals} decimals)`,
      )
      .transform(Number)
      .refine(
        (value) => (allowZero ? value >= 0 : value > 0),
        `The ${label} must be more than 0`,
      )
      .refine((value) => value < MAX_AMOUNT, `The ${label} is too large`),
  )
}

export const transactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES, "Choose a type"),
  brokerAccountId: z.uuid("Choose an account"),
  instrumentId: z.coerce
    .number("Choose a stock")
    .int("Choose a stock")
    .positive("Choose a stock"),
  tradeDate: z
    .string("Enter the date")
    .refine(isValidIsoDate, "Enter a valid date")
    .refine(
      (date) => date <= todayInIndia(),
      "The date can't be in the future",
    ),
  quantity: decimal("quantity", 8),
  price: decimal("price", 4),
  charges: z.preprocess(
    (value) => (isBlank(value) ? "0" : value),
    decimal("charges", 2, { allowZero: true }),
  ),
  notes: z.preprocess(
    (value) => (isBlank(value) ? null : value),
    z.string().trim().max(500, "Keep notes under 500 characters").nullable(),
  ),
})

export type TransactionInput = z.infer<typeof transactionSchema>
