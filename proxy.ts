import { NextResponse, type NextRequest } from "next/server"

import { supabaseEnv } from "@/lib/env"
import { DEFAULT_AFTER_LOGIN } from "@/lib/redirect"
import { updateSession } from "@/lib/supabase/proxy"

const PUBLIC_PATHS = ["/login"]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

/** Redirect while keeping any refreshed session cookies. */
function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url)
  // Keep the no-store headers Supabase adds when it refreshes the session cookie.
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header)
    if (value) redirect.headers.set(header, value)
  }
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

// Optimistic auth check only. Pages and Server Actions still call requireUser().
export async function proxy(request: NextRequest) {
  // Scheduled jobs have no session: their routes check CRON_SECRET instead.
  // (Cron requests don't follow redirects, so a login redirect would skip the job.)
  if (request.nextUrl.pathname.startsWith("/api/cron/")) {
    return NextResponse.next()
  }

  // Without Supabase settings the pages render a setup notice instead.
  if (!supabaseEnv) return NextResponse.next()

  const { response, userId } = await updateSession(request, supabaseEnv)
  const { pathname, search } = request.nextUrl

  if (!userId && !isPublicPath(pathname)) {
    const url = new URL("/login", request.url)
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`)
    return redirectWithCookies(url, response)
  }

  if (userId && isPublicPath(pathname)) {
    return redirectWithCookies(
      new URL(DEFAULT_AFTER_LOGIN, request.url),
      response,
    )
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
