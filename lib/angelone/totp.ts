// Time-based one-time passwords (RFC 6238), the 6-digit codes authenticator apps
// show. SmartAPI's login needs one; generating it here lets the server log in
// without anyone typing a code.

import { createHmac } from "node:crypto"

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

/** Decodes a base32 secret, the format shown when TOTP is enabled (spaces and padding ignored). */
export function decodeBase32(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "")
  const bytes: number[] = []
  let buffer = 0
  let bits = 0

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) throw new Error("The TOTP secret isn't valid base32.")
    buffer = ((buffer << 5) | index) & 0xffff
    bits += 5
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/** HMAC-SHA1 TOTP with a 30-second step, the same scheme authenticator apps use. */
export function generateTotp(
  secret: string | Buffer,
  now: number = Date.now(),
  { step = 30, digits = 6 }: { step?: number; digits?: number } = {},
): string {
  const key = typeof secret === "string" ? decodeBase32(secret) : secret
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / step)))

  const hmac = createHmac("sha1", key).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3]

  return String(code % 10 ** digits).padStart(digits, "0")
}
