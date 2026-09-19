import "server-only"

import { parseSectorCsv, type SectorRow } from "@/lib/sectors/parse"
import type { AppSupabaseClient } from "@/lib/supabase/types"

// NSE's Nifty Total Market index: the ~750 largest listed companies with their
// industry. niftyindices.com wants a browser-like user agent; the NSE archive
// copy is the fallback.
const SOURCES = [
  "https://www.niftyindices.com/IndexConstituent/ind_niftytotalmarket_list.csv",
  "https://archives.nseindia.com/content/indices/ind_niftytotalmarket_list.csv",
]
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
const MIN_EXPECTED_ROWS = 400
const TIMEOUT_MS = 20_000

async function downloadSectors(): Promise<SectorRow[]> {
  const problems: string[] = []
  for (const url of SOURCES) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/csv,*/*" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      })
      if (!response.ok) {
        problems.push(`${new URL(url).host} said ${response.status}`)
        continue
      }
      const rows = parseSectorCsv(await response.text())
      if (rows.length >= MIN_EXPECTED_ROWS) return rows
      problems.push(`${new URL(url).host} sent an incomplete list`)
    } catch (error) {
      problems.push(
        `${new URL(url).host}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  throw new Error(
    `Couldn't download NSE's sector list (${problems.join("; ")}).`,
  )
}

/** Saves NSE's sector for each stock, keeping sectors set by hand. Returns how many were saved. */
export async function refreshSectors(
  supabase: AppSupabaseClient,
): Promise<number> {
  const rows = await downloadSectors()

  const { data: manual, error: manualError } = await supabase
    .from("stock_sectors")
    .select("symbol")
    .eq("source", "manual")
  if (manualError) {
    throw new Error(`Couldn't load sectors: ${manualError.message}`)
  }
  const setByHand = new Set(manual.map((row) => row.symbol))

  const updates = rows
    .filter((row) => !setByHand.has(row.symbol))
    .map((row) => ({ ...row, source: "nse" }))
  const { error } = await supabase
    .from("stock_sectors")
    .upsert(updates, { onConflict: "symbol" })
  if (error) throw new Error(`Couldn't save sectors: ${error.message}`)
  return updates.length
}
