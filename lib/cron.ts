import { timingSafeEqual } from "node:crypto"

/** Vercel recommends at least 16 random characters for CRON_SECRET. */
const MIN_SECRET_LENGTH = 16

/**
 * True when the Authorization header is `Bearer <CRON_SECRET>`, which Vercel
 * sends when it runs a cron job. Compared in constant time.
 */
export function isAuthorizedCronRequest(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH || !authorization) {
    return false
  }
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(authorization)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
