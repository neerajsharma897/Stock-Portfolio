import "server-only"

import { AngelOneError, fetchCandles } from "@/lib/angelone/client"
import { getAngelOneConfig } from "@/lib/angelone/config"
import type { DailyClose } from "@/lib/benchmark/mirror"
import { todayInIndia } from "@/lib/dates"

// Nifty 50 on NSE in Angel One's instrument list.
const NIFTY_50 = { exchange: "NSE", token: "99926000" } as const
// SmartAPI returns at most 2,000 daily candles per request.
const CHUNK_DAYS = 1_900
const DAY_MS = 86_400_000
// Daily closes barely change during the day; reuse them for a while.
const CACHE_MS = 3 * 60 * 60_000
const LOGIN_ERROR_BACKOFF_MS = 10 * 60_000

/** Nifty history that can't be loaded for a reason the user can fix or wait out. */
export class BenchmarkUnavailableError extends Error {}

type Store = {
  cached?: { from: string; closes: DailyClose[]; expiresAt: number }
  loginBlockedUntil: number
}

// Kept on globalThis so it survives hot reloads in development.
const globalStore = globalThis as typeof globalThis & { __nifty?: Store }
const store = () => (globalStore.__nifty ??= { loginBlockedUntil: 0 })

/** Nifty 50's daily closes from a date (YYYY-MM-DD) to today, oldest first. */
export async function getNiftyCloses(from: string): Promise<DailyClose[]> {
  const config = getAngelOneConfig()
  if (!config) {
    throw new BenchmarkUnavailableError(
      "The Nifty 50 comparison uses Angel One's price history. Set up live prices (see Settings) to see it.",
    )
  }

  const state = store()
  const cached = state.cached
  if (cached && cached.from <= from && cached.expiresAt > Date.now()) {
    return cached.closes
  }
  if (Date.now() < state.loginBlockedUntil) {
    throw new BenchmarkUnavailableError(
      "Angel One login failed a few minutes ago. Check Settings → Live prices.",
    )
  }

  const byDate = new Map<string, number>()
  const end = Date.now()
  try {
    for (
      let start = Date.parse(`${from}T00:00:00+05:30`);
      start <= end;
      start += CHUNK_DAYS * DAY_MS
    ) {
      const chunkEnd = Math.min(end, start + (CHUNK_DAYS - 1) * DAY_MS)
      const candles = await fetchCandles(config, {
        ...NIFTY_50,
        interval: "ONE_DAY",
        fromdate: `${todayInIndia(new Date(start))} 00:00`,
        todate: `${todayInIndia(new Date(chunkEnd))} 23:59`,
      })
      for (const candle of candles) {
        byDate.set(todayInIndia(new Date(candle.time * 1000)), candle.close)
      }
    }
  } catch (error) {
    if (error instanceof AngelOneError && error.kind === "login") {
      state.loginBlockedUntil = Date.now() + LOGIN_ERROR_BACKOFF_MS
    }
    throw error
  }

  const closes = [...byDate.entries()]
    .map(([date, close]) => ({ date, close }))
    .sort((a, b) => a.date.localeCompare(b.date))
  state.cached = { from, closes, expiresAt: Date.now() + CACHE_MS }
  return closes
}
