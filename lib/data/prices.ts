import "server-only"

import { requireOwner } from "@/lib/auth"
import type { Price } from "@/lib/portfolio/valuation"
import { createClient } from "@/lib/supabase/server"

/** Latest saved price for each of the given stocks that has one. */
export async function listPrices(
  instrumentIds: Iterable<number>,
): Promise<Map<number, Price>> {
  await requireOwner()

  const ids = [...new Set(instrumentIds)]
  if (ids.length === 0) return new Map()

  const supabase = await createClient()
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
