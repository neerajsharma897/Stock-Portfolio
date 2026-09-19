import "server-only"

import { fetchQuotes } from "@/lib/angelone/client"
import type { AngelOneConfig } from "@/lib/angelone/config"
import type { AppSupabaseClient } from "@/lib/supabase/types"

/**
 * Fetches Angel One prices for every stock that appears in a transaction, on
 * the watchlist or in a price alert, and saves them to instrument_prices. Used by live refresh and the daily job.
 */
export async function fetchAndSavePrices(
  supabase: AppSupabaseClient,
  config: AngelOneConfig,
): Promise<{ saved: number; pricedAt: string | null }> {
  const [held, watched, alerted] = await Promise.all([
    supabase
      .from("transactions")
      .select("instrument:instruments(id, exchange, token)"),
    supabase
      .from("watchlist_items")
      .select("instrument:instruments(id, exchange, token)"),
    supabase
      .from("alert_rules")
      .select("instrument:instruments(id, exchange, token)")
      .eq("is_active", true),
  ])
  const error = held.error ?? watched.error ?? alerted.error
  if (error) throw new Error(`Couldn't load stocks to price: ${error.message}`)

  const instruments = new Map(
    [
      ...(held.data ?? []),
      ...(watched.data ?? []),
      ...(alerted.data ?? []),
    ].map((row) => [
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
            week52_high: quote.week52High,
            week52_low: quote.week52Low,
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
