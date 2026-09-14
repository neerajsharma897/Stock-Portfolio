import { describe, expect, it } from "vitest"

import { decodeBase32, generateTotp } from "@/lib/angelone/totp"

// Test vectors from RFC 6238, Appendix B (SHA-1, 8 digits).
const RFC_SECRET = Buffer.from("12345678901234567890", "ascii")
const RFC_VECTORS: [seconds: number, code: string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
]

describe("generateTotp", () => {
  it.each(RFC_VECTORS)("matches RFC 6238 at %i seconds", (seconds, code) => {
    expect(generateTotp(RFC_SECRET, seconds * 1000, { digits: 8 })).toBe(code)
  })

  it("produces 6-digit codes from a base32 secret by default", () => {
    const code = generateTotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)
    expect(code).toBe("287082")
  })

  it("keeps the same code within a 30-second window", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    expect(generateTotp(secret, 60_000)).toBe(generateTotp(secret, 89_999))
    expect(generateTotp(secret, 60_000)).not.toBe(generateTotp(secret, 90_000))
  })
})

describe("decodeBase32", () => {
  it("decodes secrets with spaces, lowercase and padding", () => {
    expect(decodeBase32("gezd gnbv gy3t qojq gezd gnbv gy3t qojq==")).toEqual(
      RFC_SECRET,
    )
  })

  it("rejects characters outside base32", () => {
    expect(() => decodeBase32("ABC1")).toThrow("valid base32")
  })
})
