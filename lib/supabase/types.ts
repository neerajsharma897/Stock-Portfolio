import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

/** Either the signed-in owner's client or the admin client used by scheduled jobs. */
export type AppSupabaseClient = SupabaseClient<Database>
