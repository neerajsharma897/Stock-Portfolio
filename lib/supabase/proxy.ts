import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { SupabaseEnv } from "@/lib/env"
import type { Database } from "@/lib/supabase/database.types"

/**
 * Refreshes the auth session cookie on every request and reports who is signed in.
 * Always return (or copy cookies from) the returned response, or sessions will break.
 */
export async function updateSession(request: NextRequest, env: SupabaseEnv) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        )
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        )
      },
    },
  })

  // Don't run other code between creating the client and getClaims(): it triggers the token refresh.
  const { data } = await supabase.auth.getClaims()

  return { response, userId: data?.claims.sub ?? null }
}
