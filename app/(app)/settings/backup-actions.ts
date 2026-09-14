"use server"

import { refresh } from "next/cache"

import { actionError, type FormState } from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import {
  findMissingStocks,
  readBackupUpload,
  replaceWithBackup,
} from "@/lib/backup/restore"
import { countBackup, type BackupCounts } from "@/lib/backup/schema"
import { createClient } from "@/lib/supabase/server"

export type RestorePreview =
  | {
      status: "ready"
      exportedAt: string
      encrypted: boolean
      counts: BackupCounts
    }
  | { status: "error"; message: string }

function missingStocksMessage(missing: { exchange: string; symbol: string }[]) {
  const examples = missing
    .slice(0, 5)
    .map((stock) => `${stock.symbol} (${stock.exchange})`)
    .join(", ")
  return `${missing.length} ${missing.length === 1 ? "stock" : "stocks"} in this backup ${missing.length === 1 ? "isn't" : "aren't"} in the stock list (${examples}${missing.length > 5 ? ", …" : ""}). Update the stock list above, then try again.`
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Couldn't read the backup."
}

/** Reads and checks a backup without changing anything. */
export async function previewRestore(
  formData: FormData,
): Promise<RestorePreview> {
  await requireOwner()

  try {
    const { backup, encrypted } = await readBackupUpload(
      formData.get("file"),
      formData.get("passphrase"),
    )
    const missing = await findMissingStocks(await createClient(), backup)
    if (missing.length > 0) {
      return { status: "error", message: missingStocksMessage(missing) }
    }
    return {
      status: "ready",
      exportedAt: backup.exportedAt,
      encrypted,
      counts: countBackup(backup),
    }
  } catch (error) {
    return { status: "error", message: messageOf(error) }
  }
}

/** Replaces all family data with the uploaded backup. */
export async function restoreBackup(formData: FormData): Promise<FormState> {
  await requireOwner()

  try {
    const { backup } = await readBackupUpload(
      formData.get("file"),
      formData.get("passphrase"),
    )
    const supabase = await createClient()
    const missing = await findMissingStocks(supabase, backup)
    if (missing.length > 0) return actionError(missingStocksMessage(missing))

    await replaceWithBackup(supabase, backup)
    refresh()

    const counts = countBackup(backup)
    return {
      status: "success",
      message: `Restored ${counts.members} members and ${counts.transactions} transactions from the backup.`,
    }
  } catch (error) {
    return actionError(messageOf(error))
  }
}
