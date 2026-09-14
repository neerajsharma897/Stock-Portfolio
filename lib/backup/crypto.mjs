// Encryption for backup files, shared by the app (restore) and the GitHub backup
// workflow (scripts/encrypt-backup.mjs). Plain JavaScript using only node:crypto,
// so the workflow runs it without installing packages.
//
// Format: a JSON envelope holding AES-256-GCM ciphertext. The key comes from the
// passphrase through scrypt with a random salt; GCM also detects tampering.

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto"

import { ENVELOPE_FORMAT } from "./envelope.mjs"

const VERSION = 1
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const KEY_BYTES = 32
const SALT_BYTES = 16
const IV_BYTES = 12
const TAG_BYTES = 16

/**
 * @param {string} passphrase
 * @param {Buffer} salt
 */
function deriveKey(passphrase, salt) {
  return scryptSync(
    passphrase.normalize("NFKC"),
    salt,
    KEY_BYTES,
    SCRYPT_OPTIONS,
  )
}

/**
 * Encrypts backup JSON text with a passphrase.
 * @param {string} plaintext
 * @param {string} passphrase
 * @returns {string} the encrypted envelope as JSON text
 */
export function encryptBackup(plaintext, passphrase) {
  if (!passphrase) throw new Error("A passphrase is required.")
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveKey(passphrase, salt),
    iv,
    {
      authTagLength: TAG_BYTES,
    },
  )
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])

  return JSON.stringify({
    format: ENVELOPE_FORMAT,
    version: VERSION,
    kdf: "scrypt",
    cipher: "aes-256-gcm",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  })
}

/**
 * True for a parsed encrypted backup envelope.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEncryptedBackup(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    /** @type {{ format?: unknown }} */ (value).format === ENVELOPE_FORMAT
  )
}

/**
 * Decrypts a parsed envelope. Throws a readable error for a wrong passphrase or a damaged file.
 * @param {unknown} envelope
 * @param {string} passphrase
 * @returns {string} the backup JSON text
 */
export function decryptBackup(envelope, passphrase) {
  if (!isEncryptedBackup(envelope)) {
    throw new Error("This isn't an encrypted Family Portfolio backup.")
  }
  const parts = /** @type {Record<string, unknown>} */ (envelope)
  if (parts.version !== VERSION) {
    throw new Error("This encrypted backup is from an unsupported version.")
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(passphrase, Buffer.from(String(parts.salt), "base64")),
      Buffer.from(String(parts.iv), "base64"),
      { authTagLength: TAG_BYTES },
    )
    decipher.setAuthTag(Buffer.from(String(parts.tag), "base64"))
    return Buffer.concat([
      decipher.update(Buffer.from(String(parts.data), "base64")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    throw new Error("Wrong passphrase, or the backup file is damaged.")
  }
}
