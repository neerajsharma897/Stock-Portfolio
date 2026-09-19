import "server-only"

import { AngelOneError, fetchCandles } from "@/lib/angelone/client"
import { getAngelOneConfig } from "@/lib/angelone/config"
import { requireOwner } from "@/lib/auth"
import {
  candleRequestDates,
  lastSession,
  RANGE_SPECS,
  type Candle,
  type ChartRange,
} from "@/lib/charts/candles"
import { createClient } from "@/lib/supabase/server"

// How long a chart is reused before asking Angel One again. The day chart
// changes every few minutes; daily candles barely change.
const CACHE_MS: Record<ChartRange, number> = {
  "1D": 50_000,
  "1W": 5 * 60_000,
  "1M": 15 * 60_000,
  "6M": 60 * 60_000,
  "1Y": 60 * 60_000,
  "5Y": 60 * 60_000,
}
const MAX_CACHED_CHARTS = 100
// A failed login usually means wrong settings; retrying quickly could lock the account.
const LOGIN_ERROR_BACKOFF_MS = 10 * 60_000

export type ChartData = {
  candles: Candle[]
  range: ChartRange
  intraday: boolean
  fetchedAt: string
}

/** A chart that can't be shown for a reason the user can fix or wait out. */
export class ChartUnavailableError extends Error {}

type ChartStore = {
  cache: Map<string, { data: ChartData; expiresAt: number }>
  loginBlockedUntil: number
}

// Kept on globalThis so it survives hot reloads in development.
const globalStore = globalThis as typeof globalThis & {
  __stockCharts?: ChartStore
}
const chartStore = () =>
  (globalStore.__stockCharts ??= { cache: new Map(), loginBlockedUntil: 0 })

/** A stock's price history for one chart range, from Angel One. */
export async function getChart(
  instrumentId: number,
  range: ChartRange,
): Promise<ChartData> {
  await requireOwner()

  const config = getAngelOneConfig()
  if (!config) {
    throw new ChartUnavailableError(
      "Charts use Angel One's price history. Set up live prices (see Settings) to see them.",
    )
  }

  const store = chartStore()
  const key = `${instrumentId}:${range}`
  const cached = store.cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.data
  if (Date.now() < store.loginBlockedUntil) {
    throw new ChartUnavailableError(
      "Angel One login failed a few minutes ago, so charts are paused. Check Settings → Live prices.",
    )
  }

  const supabase = await createClient()
  const { data: instrument, error } = await supabase
    .from("instruments")
    .select("exchange, token")
    .eq("id", instrumentId)
    .maybeSingle()
  if (error) throw new Error(`Couldn't load the stock: ${error.message}`)
  if (!instrument) {
    throw new ChartUnavailableError("That stock isn't in the stock list.")
  }

  try {
    const spec = RANGE_SPECS[range]
    const candles = await fetchCandles(config, {
      exchange: instrument.exchange,
      token: instrument.token,
      interval: spec.interval,
      ...candleRequestDates(range, new Date()),
    })
    const data: ChartData = {
      candles: range === "1D" ? lastSession(candles) : candles,
      range,
      intraday: spec.intraday,
      fetchedAt: new Date().toISOString(),
    }

    store.cache.delete(key)
    if (store.cache.size >= MAX_CACHED_CHARTS) {
      const oldest = store.cache.keys().next().value
      if (oldest !== undefined) store.cache.delete(oldest)
    }
    store.cache.set(key, { data, expiresAt: Date.now() + CACHE_MS[range] })
    return data
  } catch (fetchError) {
    if (fetchError instanceof AngelOneError && fetchError.kind === "login") {
      store.loginBlockedUntil = Date.now() + LOGIN_ERROR_BACKOFF_MS
    }
    throw fetchError
  }
}
