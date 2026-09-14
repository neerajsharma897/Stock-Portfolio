import "server-only"

import { requireOwner } from "@/lib/auth"
import type { Price } from "@/lib/portfolio/valuation"
import { createClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/lib/supabase/types"

/** Latest saved price for each of the given stocks that has one. */
export async function listPrices(
  instrumentIds: Iterable<number>,
): Promise<Map<number, Price>> {
  await requireOwner()
  return fetchPrices(await createClient(), instrumentIds)
}

/** Same as listPrices, with any client (scheduled jobs use the admin client). */
export async function fetchPrices(
  supabase: AppSupabaseClient,
  instrumentIds: Iterable<number>,
): Promise<Map<number, Price>> {
  const ids = [...new Set(instrumentIds)]
  if (ids.length === 0) return new Map()

  const { data, error } = await supabase
    .from("instrument_prices")
    .select("instrument_id, last_price, previous_close, priced_at, source")
    .in("instrument_id", ids)

  if (error) throw new Error(`Couldn't load prices: ${error.message}`)
  return new Map(
    data.map((row) => [
      row.instrument_id,
      {
        lastPrice: Number(row.last_price),
        previousClose:
          row.previous_close === null ? null : Number(row.previous_close),
        pricedAt: row.priced_at,
        source: row.source,
      },
    ]),
  )
}
