import { z } from "zod"

import { isBlank } from "@/lib/transactions/schema"

/** The database refuses an 11th list too (see the watchlists migration). */
export const MAX_WATCHLISTS = 10
/** Keeps live price refreshes quick. */
export const MAX_WATCHLIST_STOCKS = 50

export const watchlistSchema = z.object({
  name: z
    .string("Enter a name")
    .trim()
    .min(1, "Enter a name, e.g. Banks")
    .max(40, "Keep the name under 40 characters"),
})

export const watchlistItemSchema = z.object({
  watchlistId: z.uuid("Choose a watchlist"),
  instrumentId: z.coerce
    .number("Choose a stock")
    .int("Choose a stock")
    .positive("Choose a stock"),
  note: z.preprocess(
    (value) => (isBlank(value) ? null : value),
    z.string().trim().max(200, "Keep the note under 200 characters").nullable(),
  ),
})
