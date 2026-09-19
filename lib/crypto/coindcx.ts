import "server-only"

import {
  parseCoinMarkets,
  parseTicker,
  type CoinQuote,
} from "@/lib/crypto/parse"
import { readAllRows } from "@/lib/supabase/read-all"
import type { AppSupabaseClient } from "@/lib/supabase/types"

// CoinDCX's public market data; no API key needed.
const TICKER_URL = "https://api.coindcx.com/exchange/ticker"
const MARKETS_URL = "https://api.coindcx.com/exchange/v1/markets_details"
const TIMEOUT_MS = 20_000
const BATCH_SIZE = 500
// CoinDCX lists over 300 rupee markets; far fewer means a broken response.
const MIN_EXPECTED_COINS = 50

async function getJson(url: string, what: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Couldn't reach CoinDCX for the ${what} (${reason}).`)
  }
  if (!response.ok) {
    throw new Error(`CoinDCX returned HTTP ${response.status} for the ${what}.`)
  }
  return response.json()
}

function priceColumns(quote: CoinQuote | undefined) {
  return {
    last_price: quote?.lastPrice ?? null,
    change_24h_pct: quote?.change24hPct ?? null,
    priced_at: quote?.pricedAt ?? null,
  }
}

export type CoinListSummary = { coins: number; deactivated: number }

/**
 * Downloads every coin traded for rupees on CoinDCX, with its latest price, and
 * saves it. Pass the owner's client (after requireOwner()) or the admin client.
 */
export async function importCoinList(
  supabase: AppSupabaseClient,
): Promise<CoinListSummary> {
  const [marketsJson, tickerJson] = await Promise.all([
    getJson(MARKETS_URL, "coin list"),
    getJson(TICKER_URL, "prices"),
  ])
  const coins = parseCoinMarkets(marketsJson)
  if (coins.length < MIN_EXPECTED_COINS) {
    throw new Error(
      `CoinDCX's coin list looks incomplete (${coins.length} coins), so nothing was changed. Try again later.`,
    )
  }
  const quotes = parseTicker(tickerJson)

  const seenAt = new Date().toISOString()
  const rows = coins.map((coin) => ({
    ...coin,
    ...priceColumns(quotes.get(coin.market)),
    is_active: true,
    last_seen_at: seenAt,
  }))
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const { error } = await supabase
      .from("crypto_assets")
      .upsert(rows.slice(start, start + BATCH_SIZE), { onConflict: "market" })
    if (error) throw new Error(`Couldn't save the coin list: ${error.message}`)
  }

  // Coins no longer traded for rupees; kept so old entries still work.
  const { count, error } = await supabase
    .from("crypto_assets")
    .update({ is_active: false }, { count: "exact" })
    .lt("last_seen_at", seenAt)
    .eq("is_active", true)
  if (error) throw new Error(`Couldn't mark delisted coins: ${error.message}`)

  return { coins: coins.length, deactivated: count ?? 0 }
}

/**
 * Fetches CoinDCX's latest prices for every coin in a crypto entry and saves
 * them. Used by the live refresh and the daily snapshot.
 */
export async function fetchAndSaveCoinPrices(
  supabase: AppSupabaseClient,
): Promise<{ saved: number; pricedAt: string | null }> {
  const entries = await readAllRows("crypto entries", (from, to) =>
    supabase
      .from("crypto_transactions")
      .select("market")
      .order("id")
      .range(from, to),
  )
  const markets = [...new Set(entries.map((entry) => entry.market))]
  if (markets.length === 0) return { saved: 0, pricedAt: null }

  const [quotes, { data: coins, error }] = await Promise.all([
    getJson(TICKER_URL, "prices").then(parseTicker),
    supabase
      .from("crypto_assets")
      .select("market, symbol, name")
      .in("market", markets),
  ])
  if (error) throw new Error(`Couldn't load held coins: ${error.message}`)

  const priced = coins.flatMap((coin) => {
    const quote = quotes.get(coin.market)
    return quote ? [{ coin, quote }] : []
  })
  if (priced.length === 0) return { saved: 0, pricedAt: null }

  // Symbol and name come along because an upsert must be a complete row.
  const { error: saveError } = await supabase.from("crypto_assets").upsert(
    priced.map(({ coin, quote }) => ({ ...coin, ...priceColumns(quote) })),
    { onConflict: "market" },
  )
  if (saveError) {
    throw new Error(`Couldn't save crypto prices: ${saveError.message}`)
  }
  const pricedAt = priced
    .map(({ quote }) => quote.pricedAt)
    .reduce((latest, value) => (value > latest ? value : latest))
  return { saved: priced.length, pricedAt }
}
