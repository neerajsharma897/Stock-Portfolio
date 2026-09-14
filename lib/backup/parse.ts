import { decryptBackup, isEncryptedBackup } from "@/lib/backup/crypto.mjs"
import { backupSchema, type Backup } from "@/lib/backup/schema"

/** Largest backup accepted for restore; kept below Vercel's 4.5 MB request limit. */
export const MAX_BACKUP_BYTES = 4 * 1024 * 1024

/**
 * Reads backup file text: a plain export, or an encrypted backup (needs the
 * passphrase). Throws errors with messages that can be shown to the user.
 */
export function parseBackupText(
  text: string,
  passphrase: string | null,
): { backup: Backup; encrypted: boolean } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error("That file isn't a Family Portfolio backup.")
  }

  const encrypted = isEncryptedBackup(json)
  if (encrypted) {
    if (!passphrase) {
      throw new Error("This backup is encrypted. Enter its passphrase.")
    }
    try {
      json = JSON.parse(decryptBackup(json, passphrase))
    } catch (error) {
      throw error instanceof SyntaxError
        ? new Error("The backup file is damaged.")
        : error
    }
  }

  const parsed = backupSchema.safeParse(json)
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.join(".")
    throw new Error(
      `That file isn't a valid Family Portfolio backup${path ? ` (problem at ${path})` : ""}.`,
    )
  }
  return { backup: parsed.data, encrypted }
}
