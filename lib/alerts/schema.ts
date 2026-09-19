import { z } from "zod"

import { ALERT_KINDS, THRESHOLD_UNIT } from "@/lib/alerts/rules"
import { decimal, isBlank } from "@/lib/transactions/schema"

export const MAX_ALERT_RULES = 100

export const alertRuleSchema = z
  .object({
    instrumentId: z.coerce
      .number("Choose a stock")
      .int("Choose a stock")
      .positive("Choose a stock"),
    kind: z.enum(ALERT_KINDS, "Choose when to alert"),
    threshold: z.preprocess(
      (value) => (isBlank(value) ? null : value),
      decimal("value", 4).nullable(),
    ),
    note: z.preprocess(
      (value) => (isBlank(value) ? null : value),
      z
        .string()
        .trim()
        .max(200, "Keep the note under 200 characters")
        .nullable(),
    ),
  })
  .superRefine((rule, context) => {
    const unit = THRESHOLD_UNIT[rule.kind]
    if (unit && rule.threshold === null) {
      context.addIssue({
        code: "custom",
        path: ["threshold"],
        message:
          unit === "percent"
            ? "Enter the move in percent, e.g. 4"
            : "Enter the price",
      })
    }
    if (
      unit === "percent" &&
      rule.threshold !== null &&
      rule.threshold >= 100
    ) {
      context.addIssue({
        code: "custom",
        path: ["threshold"],
        message: "Enter a move under 100%",
      })
    }
  })
  .transform((rule) => ({
    ...rule,
    // 52-week alerts have no threshold.
    threshold: THRESHOLD_UNIT[rule.kind] ? rule.threshold : null,
  }))

const time = z
  .string("Enter a time")
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 22:00")

export const alertPreferencesSchema = z.object({
  dailySummary: z.preprocess((value) => value === "on", z.boolean()),
  systemAlerts: z.preprocess((value) => value === "on", z.boolean()),
  quietStart: time,
  quietEnd: time,
})
