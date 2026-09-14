import "server-only"

import { createClient } from "@supabase/supabase-js"

import { requireSupabaseEnv } from "@/lib/env"
import type { Database } from "@/lib/supabase/database.types"
import type { AppSupabaseClient } from "@/lib/supabase/types"

/**
 * Supabase client using the secret key, for scheduled jobs that run without a
 * signed-in user. It bypasses row level security, so only use it in cron routes,
 * never for requests from a browser.
 */
export function createAdminClient(): AppSupabaseClient {
  const { url } = requireSupabaseEnv()
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY isn't set. Scheduled jobs need it (see README).",
    )
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
