import "server-only"

import { requireOwner } from "@/lib/auth"
import { fetchAndSaveCoinPrices } from "@/lib/crypto/coindcx"
import type { CryptoLiveStatus } from "@/lib/crypto/live-status"
import { createClient } from "@/lib/supabase/server"

// How often CoinDCX is actually called, however often pages poll.
const REFRESH_INTERVAL_MS = 30_000
const ERROR_BACKOFF_MS = 2 * 60_000

type RefreshStore = {
  nextAttemptAt: number
  lastError: string | null
  inFlight?: Promise<CryptoLiveStatus>
}

// Kept on globalThis so it survives hot reloads in development.
const globalStore = globalThis as typeof globalThis & {
  __cryptoPrices?: RefreshStore
}
const refreshStore = () =>
  (globalStore.__cryptoPrices ??= { nextAttemptAt: 0, lastError: null })

/**
 * Fetches CoinDCX prices for every coin the family has entered and saves them,
 * at most every 30 seconds; other calls return without fetching.
 */
export async function refreshCryptoPrices(): Promise<CryptoLiveStatus> {
  await requireOwner()

  const store = refreshStore()
  if (store.inFlight) return store.inFlight
  if (Date.now() < store.nextAttemptAt) {
    return { refreshed: 0, pricedAt: null, error: store.lastError }
  }

  store.inFlight = runRefresh().finally(() => {
    store.inFlight = undefined
  })
  return store.inFlight
}

async function runRefresh(): Promise<CryptoLiveStatus> {
  const store = refreshStore()
  try {
    const { saved, pricedAt } = await fetchAndSaveCoinPrices(
      await createClient(),
    )
    store.lastError = null
    store.nextAttemptAt = Date.now() + REFRESH_INTERVAL_MS
    return { refreshed: saved, pricedAt, error: null }
  } catch (error) {
    store.lastError =
      error instanceof Error ? error.message : "Couldn't fetch crypto prices."
    store.nextAttemptAt = Date.now() + ERROR_BACKOFF_MS
    return { refreshed: 0, pricedAt: null, error: store.lastError }
  }
}
