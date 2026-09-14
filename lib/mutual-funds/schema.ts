import { z } from "zod"

import { isValidIsoDate, todayInIndia } from "@/lib/dates"
import { MF_TRANSACTION_TYPES } from "@/lib/mutual-funds/options"
import { decimal, isBlank } from "@/lib/transactions/schema"

/** A mutual fund entry typed into the form. Amount = units × NAV + charges. */
export const mfTransactionSchema = z.object({
  type: z.enum(MF_TRANSACTION_TYPES, "Choose a type"),
  brokerAccountId: z.uuid("Choose where the fund is held"),
  amfiCode: z.coerce
    .number("Choose a fund")
    .int("Choose a fund")
    .positive("Choose a fund"),
  folioNumber: z.preprocess(
    (value) => (isBlank(value) ? null : value),
    z
      .string()
      .trim()
      .max(30, "Keep the folio number under 30 characters")
      .nullable(),
  ),
  tradeDate: z
    .string("Enter the date")
    .refine(isValidIsoDate, "Enter a valid date")
    .refine(
      (date) => date <= todayInIndia(),
      "The date can't be in the future",
    ),
  units: decimal("units", 4),
  nav: decimal("NAV", 4),
  charges: z.preprocess(
    (value) => (isBlank(value) ? "0" : value),
    decimal("charges", 2, { allowZero: true }),
  ),
  notes: z.preprocess(
    (value) => (isBlank(value) ? null : value),
    z.string().trim().max(500, "Keep notes under 500 characters").nullable(),
  ),
})

export type MfTransactionInput = z.infer<typeof mfTransactionSchema>
