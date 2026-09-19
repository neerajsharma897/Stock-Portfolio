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

export type OwnerAccess = "owner" | "needs_mfa" | "not_owner"

/**
 * Whether the signed-in user is the owner, and whether they still need to enter
 * their two-step sign-in code (see public.owner_access()). Memoized per render.
 */
export const ownerAccess = cache(async (): Promise<OwnerAccess> => {
  if (!supabaseEnv) return "not_owner"

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("owner_access")
  if (error) {
    // Before the two-step sign-in migration runs, only the owner check exists.
    const fallback = await supabase.rpc("is_owner")
    return !fallback.error && fallback.data === true ? "owner" : "not_owner"
  }
  return data === "owner" || data === "needs_mfa" ? data : "not_owner"
})

/** Whether the signed-in user is the owner with a complete sign-in. */
export const isOwner = cache(
  async (): Promise<boolean> => (await ownerAccess()) === "owner",
)

/** Use in every Server Action and data loader that reads or changes family data. */
export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireUser()
  const access = await ownerAccess()
  if (access === "needs_mfa") redirect("/verify")
  if (access !== "owner") throw new Error("Only the app owner can do this.")
  return user
}

/** Whether an authenticator app is set up for two-step sign-in. */
export async function hasTwoStepSignIn(): Promise<boolean> {
  await requireOwner()
  const supabase = await createClient()
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error)
    throw new Error(`Couldn't check two-step sign-in: ${error.message}`)
  return data.totp.length > 0
}
