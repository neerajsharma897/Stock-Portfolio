"use server"

import { refresh } from "next/cache"

import { actionError, type FormState } from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import {
  findMissingFunds,
  findMissingStocks,
  readBackupUpload,
  replaceWithBackup,
} from "@/lib/backup/restore"
import {
  countBackup,
  type Backup,
  type BackupCounts,
} from "@/lib/backup/schema"
import { createClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/lib/supabase/types"

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

function missingFundsMessage(missing: number[]) {
  const examples = missing.slice(0, 5).join(", ")
  return `${missing.length} mutual ${missing.length === 1 ? "fund" : "funds"} in this backup ${missing.length === 1 ? "isn't" : "aren't"} in the fund list (scheme ${missing.length === 1 ? "code" : "codes"} ${examples}${missing.length > 5 ? ", …" : ""}). Download the fund list above, then try again.`
}

/** A message when the backup refers to stocks or funds this database doesn't have. */
async function checkReferences(
  supabase: AppSupabaseClient,
  backup: Backup,
): Promise<string | null> {
  const [stocks, funds] = await Promise.all([
    findMissingStocks(supabase, backup),
    findMissingFunds(supabase, backup),
  ])
  if (stocks.length > 0) return missingStocksMessage(stocks)
  if (funds.length > 0) return missingFundsMessage(funds)
  return null
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
    const problem = await checkReferences(await createClient(), backup)
    if (problem) return { status: "error", message: problem }
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
    const problem = await checkReferences(supabase, backup)
    if (problem) return actionError(problem)

    await replaceWithBackup(supabase, backup)
    refresh()

    const counts = countBackup(backup)
    return {
      status: "success",
      message: `Restored ${counts.members} members, ${counts.transactions} stock transactions and ${counts.fundEntries} mutual fund entries from the backup.`,
    }
  } catch (error) {
    return actionError(messageOf(error))
  }
}
