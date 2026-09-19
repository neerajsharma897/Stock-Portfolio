import { z } from "zod"

import { isValidIsoDate, todayInIndia } from "@/lib/dates"
import { decimal, isBlank } from "@/lib/transactions/schema"
import { TRANSACTION_TYPES } from "@/lib/transactions/options"

/** A crypto buy, sell or opening balance typed into the form. */
export const cryptoTransactionSchema = z.object({
  type: z.enum(TRANSACTION_TYPES, "Choose a type"),
  brokerAccountId: z.uuid("Choose an account"),
  market: z
    .string("Choose a coin")
    .regex(/^[A-Z0-9]{1,26}INR$/, "Choose a coin"),
  tradeDate: z
    .string("Enter the date")
    .refine(isValidIsoDate, "Enter a valid date")
    .refine(
      (date) => date <= todayInIndia(),
      "The date can't be in the future",
    ),
  // CoinDCX quantities go to 8 decimals; prices of small coins to 10.
  quantity: decimal("quantity", 8),
  price: decimal("price", 10),
  charges: z.preprocess(
    (value) => (isBlank(value) ? "0" : value),
    decimal("fees", 2, { allowZero: true }),
  ),
  notes: z.preprocess(
    (value) => (isBlank(value) ? null : value),
    z.string().trim().max(500, "Keep notes under 500 characters").nullable(),
  ),
})

export type CryptoTransactionInput = z.infer<typeof cryptoTransactionSchema>
