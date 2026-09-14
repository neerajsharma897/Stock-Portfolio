import { z } from "zod"

const notPlaceholder = (value: string) => !value.includes("your-")

const supabaseEnvSchema = z.object({
  url: z.url().refine(notPlaceholder),
  publishableKey: z.string().min(1).refine(notPlaceholder),
})

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>

// NEXT_PUBLIC_ variables must be referenced literally so Next.js can inline them.
const parsed = supabaseEnvSchema.safeParse({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
})

/** Null until .env.local is filled in; pages show a setup notice instead of crashing. */
export const supabaseEnv: SupabaseEnv | null = parsed.success
  ? parsed.data
  : null

export function requireSupabaseEnv(): SupabaseEnv {
  if (!supabaseEnv) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in the values.",
    )
  }
  return supabaseEnv
}
