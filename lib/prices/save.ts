import "server-only"

import { fetchQuotes } from "@/lib/angelone/client"
import type { AngelOneConfig } from "@/lib/angelone/config"
import type { AppSupabaseClient } from "@/lib/supabase/types"

/**
 * Fetches Angel One prices for every stock that appears in a transaction or on
 * the watchlist and saves them to instrument_prices. Used by live refresh and the daily job.
 */
export async function fetchAndSavePrices(
  supabase: AppSupabaseClient,
  config: AngelOneConfig,
): Promise<{ saved: number; pricedAt: string | null }> {
  const [held, watched] = await Promise.all([
    supabase
      .from("transactions")
      .select("instrument:instruments(id, exchange, token)"),
    supabase
      .from("watchlist_items")
      .select("instrument:instruments(id, exchange, token)"),
  ])
  const error = held.error ?? watched.error
  if (error) throw new Error(`Couldn't load stocks to price: ${error.message}`)

  const instruments = new Map(
    [...(held.data ?? []), ...(watched.data ?? [])].map((row) => [
      row.instrument.id,
      row.instrument,
    ]),
  )
  if (instruments.size === 0) return { saved: 0, pricedAt: null }

  const quotes = await fetchQuotes(
    config,
    [...instruments.values()].map(({ exchange, token }) => ({
      exchange,
      token,
    })),
  )
  const idByToken = new Map(
    [...instruments.values()].map((instrument) => [
      `${instrument.exchange}:${instrument.token}`,
      instrument.id,
    ]),
  )

  const pricedAt = new Date().toISOString()
  const updates = quotes.flatMap((quote) => {
    const instrumentId = idByToken.get(`${quote.exchange}:${quote.token}`)
    return instrumentId === undefined
      ? []
      : [
          {
            instrument_id: instrumentId,
            last_price: quote.lastPrice,
            previous_close: quote.previousClose,
            source: "angelone" as const,
            priced_at: pricedAt,
          },
        ]
  })
  if (updates.length === 0) return { saved: 0, pricedAt: null }

  const { error: saveError } = await supabase
    .from("instrument_prices")
    .upsert(updates, { onConflict: "instrument_id" })
  if (saveError) {
    throw new Error(`Couldn't save live prices: ${saveError.message}`)
  }
  return { saved: updates.length, pricedAt }
}
