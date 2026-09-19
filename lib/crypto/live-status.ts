// Shared between the server (which refreshes crypto prices) and the live crypto badge.

export type CryptoLiveStatus = {
  /** Coin prices saved by this refresh (0 when it was skipped). */
  refreshed: number
  /** CoinDCX's time for the newest saved price, when this refresh saved any. */
  pricedAt: string | null
  error: string | null
}
