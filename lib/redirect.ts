export const DEFAULT_AFTER_LOGIN = "/dashboard"

const BASE = "http://internal.invalid"

/** Only allow same-site paths, so `?next=` can't send the user to another website. */
export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return DEFAULT_AFTER_LOGIN
  }

  // Parse the way a browser would (it drops tabs/newlines and treats "\" as "/"),
  // then check the result still points at this site.
  let url: URL
  try {
    url = new URL(value, BASE)
  } catch {
    return DEFAULT_AFTER_LOGIN
  }
  if (url.origin !== BASE || url.pathname === "/login") {
    return DEFAULT_AFTER_LOGIN
  }

  return `${url.pathname}${url.search}${url.hash}`
}
