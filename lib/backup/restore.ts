import "server-only"

import { MAX_BACKUP_BYTES, parseBackupText } from "@/lib/backup/parse"
import { coinRefs, fundRefs, stockRefs, type Backup } from "@/lib/backup/schema"
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

/** AMFI codes the backup refers to that aren't in this database's fund list. */
export async function findMissingFunds(
  supabase: AppSupabaseClient,
  backup: Backup,
): Promise<number[]> {
  const codes = fundRefs(backup)
  const known = new Set<number>()

  for (let start = 0; start < codes.length; start += TOKEN_CHUNK) {
    const { data, error } = await supabase
      .from("mf_schemes")
      .select("amfi_code")
      .in("amfi_code", codes.slice(start, start + TOKEN_CHUNK))
    if (error) throw new Error(`Couldn't check the fund list: ${error.message}`)
    for (const row of data) known.add(row.amfi_code)
  }

  return codes.filter((code) => !known.has(code))
}

/** CoinDCX markets the backup refers to that aren't in this database's coin list. */
export async function findMissingCoins(
  supabase: AppSupabaseClient,
  backup: Backup,
): Promise<string[]> {
  const markets = coinRefs(backup)
  const known = new Set<string>()

  for (let start = 0; start < markets.length; start += TOKEN_CHUNK) {
    const { data, error } = await supabase
      .from("crypto_assets")
      .select("market")
      .in("market", markets.slice(start, start + TOKEN_CHUNK))
    if (error) throw new Error(`Couldn't check the coin list: ${error.message}`)
    for (const row of data) known.add(row.market)
  }

  return markets.filter((market) => !known.has(market))
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
