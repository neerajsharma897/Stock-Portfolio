import { z } from "zod"

import { isValidIsoDate, todayInIndia } from "@/lib/dates"
import type { Enums } from "@/lib/supabase/database.types"
import { isBlank } from "@/lib/transactions/schema"

export type CorporateActionKind = Enums<"corporate_action_kind">

export const CORPORATE_ACTION_LABELS: Record<CorporateActionKind, string> = {
  split: "Split",
  bonus: "Bonus",
}
export const CORPORATE_ACTION_KINDS = Object.keys(CORPORATE_ACTION_LABELS) as [
  CorporateActionKind,
  ...CorporateActionKind[],
]

/** "Split 1 → 5" or "Bonus 1 for every 2 held". */
export function describeCorporateAction(action: {
  kind: CorporateActionKind
  ratioFrom: number
  ratioTo: number
}): string {
  return action.kind === "split"
    ? `Split ${action.ratioFrom} → ${action.ratioTo}`
    : `Bonus ${action.ratioTo} for every ${action.ratioFrom} held`
}

const ratio = (label: string) =>
  z.coerce
    .number(`Enter ${label}`)
    .int(`Enter ${label} as a whole number`)
    .min(1, `${label[0].toUpperCase()}${label.slice(1)} must be at least 1`)
    .max(1000, `${label[0].toUpperCase()}${label.slice(1)} is too large`)

// Announced splits and bonuses can be entered up to a year ahead of the ex-date.
const MAX_DAYS_AHEAD = 366

function latestExDate() {
  const date = new Date(`${todayInIndia()}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + MAX_DAYS_AHEAD)
  return date.toISOString().slice(0, 10)
}

export const corporateActionSchema = z
  .object({
    instrumentId: z.coerce
      .number("Choose a stock")
      .int("Choose a stock")
      .positive("Choose a stock"),
    kind: z.enum(CORPORATE_ACTION_KINDS, "Choose split or bonus"),
    ratioFrom: ratio("the number of shares"),
    ratioTo: ratio("the number of shares"),
    exDate: z
      .string("Enter the ex-date")
      .refine(isValidIsoDate, "Enter a valid date")
      .refine((date) => date <= latestExDate(), "The ex-date is too far ahead"),
    notes: z.preprocess(
      (value) => (isBlank(value) ? null : value),
      z.string().trim().max(200, "Keep notes under 200 characters").nullable(),
    ),
  })
  .refine(
    (action) => action.kind === "bonus" || action.ratioFrom !== action.ratioTo,
    { path: ["ratioTo"], message: "A split changes the number of shares" },
  )

export type CorporateActionInput = z.infer<typeof corporateActionSchema>
