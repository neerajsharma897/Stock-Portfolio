import "server-only"

import { parseScripMaster } from "@/lib/instruments/parse"
import { createClient } from "@/lib/supabase/server"

// Official links from the Instruments section of Angel One's SmartAPI docs.
// The second is a fallback if the first is down.
const SOURCES = [
  "https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json",
  "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json",
]
const DOWNLOAD_TIMEOUT_MS = 90_000
const BATCH_SIZE = 1000
// The real file yields well over this; fewer means a broken download, so change nothing.
const MIN_EXPECTED_RECORDS = 1000

async function downloadInstrumentFile(): Promise<unknown> {
  let lastProblem = "no response"
  for (const url of SOURCES) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      })
      if (response.ok) return await response.json()
      lastProblem = `HTTP ${response.status} from ${new URL(url).host}`
    } catch (error) {
      lastProblem = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(`Couldn't download the stock list (${lastProblem}).`)
}

export type ImportSummary = { imported: number; deactivated: number }

/** Downloads the instrument file and upserts it. Callers must check requireOwner() first. */
export async function importInstruments(): Promise<ImportSummary> {
  const records = parseScripMaster(await downloadInstrumentFile())
  if (records.length < MIN_EXPECTED_RECORDS) {
    throw new Error(
      `The downloaded stock list looks incomplete (${records.length} entries), so nothing was changed. Try again later.`,
    )
  }

  const seenAt = new Date().toISOString()
  const supabase = await createClient()

  for (let start = 0; start < records.length; start += BATCH_SIZE) {
    const batch = records
      .slice(start, start + BATCH_SIZE)
      .map((record) => ({ ...record, is_active: true, last_seen_at: seenAt }))
    const { error } = await supabase
      .from("instruments")
      .upsert(batch, { onConflict: "exchange,token" })
    if (error) throw new Error(`Couldn't save the stock list: ${error.message}`)
  }

  // Anything this update didn't include has been delisted or renamed.
  const { count, error } = await supabase
    .from("instruments")
    .update({ is_active: false }, { count: "exact" })
    .lt("last_seen_at", seenAt)
    .eq("is_active", true)
  if (error) {
    throw new Error(`Couldn't mark delisted stocks: ${error.message}`)
  }

  return { imported: records.length, deactivated: count ?? 0 }
}
