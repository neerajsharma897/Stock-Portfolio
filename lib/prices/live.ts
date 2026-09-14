import "server-only"

import { unstable_rethrow } from "next/navigation"

import { AngelOneError, fetchQuotes } from "@/lib/angelone/client"
import { getAngelOneConfig, type AngelOneConfig } from "@/lib/angelone/config"
import { requireOwner } from "@/lib/auth"
import { listMarketHolidays, type MarketHoliday } from "@/lib/data/holidays"
import { getMarketStatus, type MarketStatus } from "@/lib/market-hours"
import type { LiveStatus } from "@/lib/prices/live-status"
import { createClient } from "@/lib/supabase/server"

// How often Angel One is actually called, however often pages poll.
const OPEN_INTERVAL_MS = 4_000
const CLOSED_INTERVAL_MS = 30 * 60_000
const REQUEST_ERROR_BACKOFF_MS = 30_000
// A failed login usually means wrong settings; retrying quickly could lock the account.
const LOGIN_ERROR_BACKOFF_MS = 10 * 60_000

type RefreshStore = {
  nextAttemptAt: number
  lastFetchedAt: string | null
  lastError: string | null
  inFlight?: Promise<LiveStatus>
}

// Kept on globalThis so it survives hot reloads in development.
const globalStore = globalThis as typeof globalThis & {
  __livePrices?: RefreshStore
}
const refreshStore = () =>
  (globalStore.__livePrices ??= {
    nextAttemptAt: 0,
    lastFetchedAt: null,
    lastError: null,
  })

async function loadMarketStatus(): Promise<MarketStatus> {
  let holidays: MarketHoliday[] = []
  try {
    holidays = await listMarketHolidays()
  } catch (error) {
    // Holidays are optional, and their table may not be migrated yet. Fall back
    // to weekdays and session hours so the dashboard keeps working; Settings
    // shows the problem.
    unstable_rethrow(error)
  }
  return getMarketStatus(
    new Date(),
    new Map(holidays.map((holiday) => [holiday.date, holiday.description])),
  )
}

/** Status for the live prices badge, without calling Angel One. */
export async function getLiveStatus(): Promise<LiveStatus> {
  await requireOwner()

  const store = refreshStore()
  let lastFetchedAt = store.lastFetchedAt
  if (!lastFetchedAt) {
    const supabase = await createClient()
    const { data } = await supabase
      .from("instrument_prices")
      .select("priced_at")
      .eq("source", "angelone")
      .order("priced_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    lastFetchedAt = data?.priced_at ?? null
  }

  return {
    configured: getAngelOneConfig() !== null,
    market: await loadMarketStatus(),
    refreshed: 0,
    lastFetchedAt,
    error: store.lastError,
  }
}

/**
 * Fetches prices for every stock the family has traded and saves them.
 * Calls Angel One at most every 4 seconds while the market is open
 * (every 30 minutes otherwise); other calls return the current status.
 */
export async function refreshLivePrices(): Promise<LiveStatus> {
  await requireOwner()

  const market = await loadMarketStatus()
  const config = getAngelOneConfig()
  const store = refreshStore()
  const current: LiveStatus = {
    configured: config !== null,
    market,
    refreshed: 0,
    lastFetchedAt: store.lastFetchedAt,
    error: store.lastError,
  }

  if (!config) return { ...current, error: null }
  if (store.inFlight) return store.inFlight
  if (Date.now() < store.nextAttemptAt) return current

  store.inFlight = runRefresh(config, market).finally(() => {
    store.inFlight = undefined
  })
  return store.inFlight
}

async function runRefresh(
  config: AngelOneConfig,
  market: MarketStatus,
): Promise<LiveStatus> {
  const store = refreshStore()
  const interval = market.open ? OPEN_INTERVAL_MS : CLOSED_INTERVAL_MS

  try {
    const supabase = await createClient()
    const { data: rows, error } = await supabase
      .from("transactions")
      .select("instrument:instruments(id, exchange, token)")
    if (error) throw new Error(`Couldn't load held stocks: ${error.message}`)

    const instruments = new Map(
      rows.map((row) => [row.instrument.id, row.instrument]),
    )
    let refreshed = 0

    if (instruments.size > 0) {
      const quotes = await fetchQuotes(
        config,
        [...instruments.values()].map(({ exchange, token }) => ({
          exchange,
          token,
        })),
      )
      const idByToken = new Map(
        [...instruments.values()].map((i) => [
          `${i.exchange}:${i.token}`,
          i.id,
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

      if (updates.length > 0) {
        const { error: saveError } = await supabase
          .from("instrument_prices")
          .upsert(updates, { onConflict: "instrument_id" })
        if (saveError) {
          throw new Error(`Couldn't save live prices: ${saveError.message}`)
        }
        store.lastFetchedAt = pricedAt
        refreshed = updates.length
      }
    }

    store.lastError = null
    store.nextAttemptAt = Date.now() + interval
    return {
      configured: true,
      market,
      refreshed,
      lastFetchedAt: store.lastFetchedAt,
      error: null,
    }
  } catch (error) {
    const loginFailed = error instanceof AngelOneError && error.kind === "login"
    store.lastError =
      error instanceof Error ? error.message : "Couldn't fetch live prices."
    store.nextAttemptAt =
      Date.now() +
      (loginFailed
        ? LOGIN_ERROR_BACKOFF_MS
        : Math.max(interval, REQUEST_ERROR_BACKOFF_MS))
    return {
      configured: true,
      market,
      refreshed: 0,
      lastFetchedAt: store.lastFetchedAt,
      error: store.lastError,
    }
  }
}
