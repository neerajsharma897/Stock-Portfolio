import "server-only"

import { requireOwner } from "@/lib/auth"
import { normalizeSearchQuery, rankInstruments } from "@/lib/instruments/search"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export type InstrumentOption = Pick<
  Tables<"instruments">,
  "id" | "exchange" | "symbol" | "name" | "series" | "kind"
>

const CANDIDATE_LIMIT = 60
const RESULT_LIMIT = 15

/** Active shares and gold bonds matching a ticker, best matches first. */
export async function searchInstruments(
  rawQuery: string,
): Promise<InstrumentOption[]> {
  await requireOwner()

  const query = normalizeSearchQuery(rawQuery)
  if (query.length < 2) return []

  const supabase = await createClient()
  const activeStocks = () =>
    supabase
      .from("instruments")
      .select("id, exchange, symbol, name, series, kind")
      .eq("is_active", true)
      .neq("kind", "index")

  // Separate queries, so the many "contains" matches of a short search can't
  // crowd exact and prefix matches out of the candidate limit.
  const [prefixMatches, containsMatches] = await Promise.all([
    activeStocks()
      .ilike("symbol", `${query}%`)
      .order("symbol")
      .limit(CANDIDATE_LIMIT),
    activeStocks()
      .ilike("name", `%${query}%`)
      .order("symbol")
      .limit(CANDIDATE_LIMIT),
  ])
  const error = prefixMatches.error ?? containsMatches.error
  if (error) throw new Error(`Couldn't search stocks: ${error.message}`)

  const unique = new Map(
    [...(prefixMatches.data ?? []), ...(containsMatches.data ?? [])].map(
      (item) => [item.id, item],
    ),
  )
  return rankInstruments([...unique.values()], query, RESULT_LIMIT)
}

export type StockListStatus = { count: number; lastUpdated: string | null }

/** How many shares and gold bonds are in the list, and when it was last updated. */
export async function getStockListStatus(): Promise<StockListStatus> {
  await requireOwner()

  const supabase = await createClient()
  const [countResult, latestResult] = await Promise.all([
    supabase
      .from("instruments")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .neq("kind", "index"),
    supabase
      .from("instruments")
      .select("last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const error = countResult.error ?? latestResult.error
  if (error) {
    throw new Error(`Couldn't load the stock list status: ${error.message}`)
  }
  return {
    count: countResult.count ?? 0,
    lastUpdated: latestResult.data?.last_seen_at ?? null,
  }
}
