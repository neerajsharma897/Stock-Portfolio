import "server-only"

import { z } from "zod"

// Server-only settings for Angel One SmartAPI. Never prefix these with
// NEXT_PUBLIC_: they would be sent to the browser.
const angelOneEnvSchema = z.object({
  apiKey: z.string().trim().min(1),
  clientCode: z.string().trim().min(1),
  pin: z.string().trim().min(1),
  totpSecret: z
    .string()
    .trim()
    .regex(/^[A-Za-z2-7=\s]+$/),
})

export type AngelOneConfig = z.infer<typeof angelOneEnvSchema>

/** Null until all four ANGELONE_* variables are set; live prices stay off until then. */
export function getAngelOneConfig(): AngelOneConfig | null {
  const parsed = angelOneEnvSchema.safeParse({
    apiKey: process.env.ANGELONE_API_KEY,
    clientCode: process.env.ANGELONE_CLIENT_CODE,
    pin: process.env.ANGELONE_PIN,
    totpSecret: process.env.ANGELONE_TOTP_SECRET,
  })
  return parsed.success ? parsed.data : null
}
