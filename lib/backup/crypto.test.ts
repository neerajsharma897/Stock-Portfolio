import { describe, expect, it } from "vitest"

import {
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
} from "@/lib/backup/crypto.mjs"

const PLAINTEXT = JSON.stringify({
  app: "family-portfolio",
  secret: "PAN 234F",
})

describe("encryptBackup / decryptBackup", () => {
  it("round-trips with the right passphrase and hides the contents", () => {
    const envelopeText = encryptBackup(
      PLAINTEXT,
      "correct horse battery staple",
    )
    expect(envelopeText).not.toContain("234F")

    const envelope = JSON.parse(envelopeText)
    expect(isEncryptedBackup(envelope)).toBe(true)
    expect(decryptBackup(envelope, "correct horse battery staple")).toBe(
      PLAINTEXT,
    )
  })

  it("uses a fresh salt and IV each time", () => {
    expect(encryptBackup(PLAINTEXT, "pass")).not.toBe(
      encryptBackup(PLAINTEXT, "pass"),
    )
  })

  it("rejects a wrong passphrase", () => {
    const envelope = JSON.parse(encryptBackup(PLAINTEXT, "right"))
    expect(() => decryptBackup(envelope, "wrong")).toThrow("Wrong passphrase")
  })

  it("detects a tampered file", () => {
    const envelope = JSON.parse(encryptBackup(PLAINTEXT, "right"))
    const data = Buffer.from(envelope.data, "base64")
    data[0] ^= 0xff
    envelope.data = data.toString("base64")
    expect(() => decryptBackup(envelope, "right")).toThrow("damaged")
  })

  it("refuses anything that isn't an encrypted backup", () => {
    expect(isEncryptedBackup({ app: "family-portfolio" })).toBe(false)
    expect(() => decryptBackup({ app: "family-portfolio" }, "x")).toThrow(
      "isn't an encrypted",
    )
  })
})
