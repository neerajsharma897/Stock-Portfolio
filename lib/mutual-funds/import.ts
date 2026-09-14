import "server-only"

import { parseAmfiNav, type SchemeRecord } from "@/lib/mutual-funds/parse-amfi"
import type { AppSupabaseClient } from "@/lib/supabase/types"

// AMFI's daily NAV file. The www.amfiindia.com address redirects to the portal.
const SOURCES = [
  "https://portal.amfiindia.com/spages/NAVAll.txt",
  "https://www.amfiindia.com/spages/NAVAll.txt",
]
const DOWNLOAD_TIMEOUT_MS = 60_000
const PAGE_SIZE = 1000
// The real file lists over 14,000 funds; far fewer means a broken download.
const MIN_EXPECTED_RECORDS = 5000

async function downloadNavFile(): Promise<string> {
  let lastProblem = "no response"
  for (const url of SOURCES) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      })
      if (response.ok) return await response.text()
      lastProblem = `HTTP ${response.status} from ${new URL(url).host}`
    } catch (error) {
      lastProblem = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(`Couldn't download AMFI's NAV file (${lastProblem}).`)
}

type StoredNav = {
  amfi_code: number
  nav: number | null
  nav_date: string | null
  previous_nav: number | null
  previous_nav_date: string | null
}

async function loadStoredNavs(
  supabase: AppSupabaseClient,
): Promise<Map<number, StoredNav>> {
  const stored = new Map<number, StoredNav>()
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("mf_schemes")
      .select("amfi_code, nav, nav_date, previous_nav, previous_nav_date")
      .order("amfi_code")
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Couldn't read saved NAVs: ${error.message}`)
    for (const row of data) stored.set(row.amfi_code, row)
    if (data.length < PAGE_SIZE) return stored
  }
}

/** Keeps the NAV before a new NAV date as "previous", for today's change. */
export function withPreviousNav(record: SchemeRecord, stored?: StoredNav) {
  const moved =
    stored?.nav != null &&
    stored.nav_date != null &&
    record.nav_date != null &&
    record.nav_date > stored.nav_date
  return {
    ...record,
    previous_nav: moved ? stored.nav : (stored?.previous_nav ?? null),
    previous_nav_date: moved
      ? stored.nav_date
      : (stored?.previous_nav_date ?? null),
  }
}

export type FundListSummary = {
  funds: number
  navsUpdated: number
  deactivated: number
}

/**
 * Downloads AMFI's fund list with the latest NAVs and saves it. Pass the owner's
 * client (after requireOwner()) or the admin client in the nightly job.
 */
export async function importMutualFunds(
  supabase: AppSupabaseClient,
): Promise<FundListSummary> {
  const records = parseAmfiNav(await downloadNavFile())
  if (records.length < MIN_EXPECTED_RECORDS) {
    throw new Error(
      `AMFI's NAV file looks incomplete (${records.length} funds), so nothing was changed. Try again later.`,
    )
  }

  const stored = await loadStoredNavs(supabase)
  const seenAt = new Date().toISOString()
  let navsUpdated = 0

  const rows = records.map((record) => {
    const previous = stored.get(record.amfi_code)
    if (record.nav_date && record.nav_date !== previous?.nav_date) navsUpdated++
    return {
      ...withPreviousNav(record, previous),
      is_active: true,
      last_seen_at: seenAt,
    }
  })

  for (let start = 0; start < rows.length; start += PAGE_SIZE) {
    const { error } = await supabase
      .from("mf_schemes")
      .upsert(rows.slice(start, start + PAGE_SIZE), { onConflict: "amfi_code" })
    if (error) throw new Error(`Couldn't save the fund list: ${error.message}`)
  }

  // Funds missing from today's file have closed or merged.
  const { count, error } = await supabase
    .from("mf_schemes")
    .update({ is_active: false }, { count: "exact" })
    .lt("last_seen_at", seenAt)
    .eq("is_active", true)
  if (error) throw new Error(`Couldn't mark closed funds: ${error.message}`)

  return { funds: records.length, navsUpdated, deactivated: count ?? 0 }
}
