import { z } from "zod"

import {
  BROKERS,
  MEMBER_COLOR_VALUES,
  MEMBER_RELATIONS,
} from "@/lib/members/options"

/** Optional form field: blank or missing becomes null, anything else must pass `schema`. */
function optionalField(schema: z.ZodType<string>) {
  return z.preprocess(
    (value) =>
      value === undefined || (typeof value === "string" && value.trim() === "")
        ? null
        : value,
    schema.nullable(),
  )
}

export const memberSchema = z.object({
  name: z
    .string("Enter a name")
    .trim()
    .min(1, "Enter a name")
    .max(60, "Keep the name under 60 characters"),
  relation: z.enum(MEMBER_RELATIONS, "Choose a relation"),
  color: z.enum(MEMBER_COLOR_VALUES, "Choose a colour"),
  panLast4: optionalField(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^[0-9]{3}[A-Z]$/,
        "Enter the last 4 characters of the PAN, e.g. 234F",
      ),
  ),
  notes: optionalField(
    z.string().trim().max(500, "Keep notes under 500 characters"),
  ),
})

export type MemberInput = z.infer<typeof memberSchema>

export const brokerAccountSchema = z.object({
  broker: z.enum(BROKERS, "Choose a broker"),
  label: optionalField(
    z.string().trim().max(40, "Keep the label under 40 characters"),
  ),
  clientIdLast4: optionalField(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,4}$/, "Up to 4 letters or digits, e.g. 4521"),
  ),
  notes: optionalField(
    z.string().trim().max(500, "Keep notes under 500 characters"),
  ),
})

export type BrokerAccountInput = z.infer<typeof brokerAccountSchema>
