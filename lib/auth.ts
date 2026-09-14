import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"

import { supabaseEnv } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"

export type CurrentUser = { id: string; email: string }

/** Verified user for this request (JWT checked by getClaims), or null. Memoized per render. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Not configured yet: treat as signed out, so /login shows the setup notice.
  if (!supabaseEnv) return null

  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data) return null
  return { id: data.claims.sub, email: data.claims.email ?? "" }
})

/** Use in every protected page, Server Action and Route Handler; don't rely on the proxy alone. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}
