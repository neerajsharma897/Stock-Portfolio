import "server-only"

import { MAX_BACKUP_BYTES, parseBackupText } from "@/lib/backup/parse"
import { stockRefs, type Backup } from "@/lib/backup/schema"
import type { Json } from "@/lib/supabase/database.types"
import type { AppSupabaseClient } from "@/lib/supabase/types"

const TOKEN_CHUNK = 200

/** Reads an uploaded backup file from a form. Errors have user-facing messages. */
export async function readBackupUpload(
  file: FormDataEntryValue | null,
  passphrase: FormDataEntryValue | null,
): Promise<{ backup: Backup; encrypted: boolean }> {
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a backup file.")
  }
  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error("That file is too large to be a backup.")
  }
  return parseBackupText(
    await file.text(),
    typeof passphrase === "string" && passphrase !== "" ? passphrase : null,
  )
}

/** Stocks the backup refers to that aren't in this database's stock list. */
export async function findMissingStocks(
  supabase: AppSupabaseClient,
  backup: Backup,
) {
  const refs = stockRefs(backup)
  const tokens = [...new Set(refs.map((ref) => ref.token))]
  const known = new Set<string>()

  for (let start = 0; start < tokens.length; start += TOKEN_CHUNK) {
    const { data, error } = await supabase
      .from("instruments")
      .select("exchange, token")
      .in("token", tokens.slice(start, start + TOKEN_CHUNK))
    if (error)
      throw new Error(`Couldn't check the stock list: ${error.message}`)
    for (const row of data) known.add(`${row.exchange}:${row.token}`)
  }

  return refs.filter((ref) => !known.has(`${ref.exchange}:${ref.token}`))
}

/** Replaces all family data with the backup, in one database transaction. */
export async function replaceWithBackup(
  supabase: AppSupabaseClient,
  backup: Backup,
): Promise<void> {
  const { error } = await supabase.rpc("restore_family_data", {
    backup: backup as unknown as Json,
  })
  if (error)
    throw new Error(`Restore failed, nothing was changed: ${error.message}`)
}
