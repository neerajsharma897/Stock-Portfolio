// CoinDCX's public market data. Both endpoints list every market on the exchange;
// only coins traded against the rupee (e.g. BTCINR) are kept.
//   /exchange/v1/markets_details: names and trading status
//   /exchange/ticker:             latest price and 24-hour change

export type CoinRecord = {
  /** CoinDCX market, e.g. "BTCINR". */
  market: string
  /** e.g. "BTC" */
  symbol: string
  /** e.g. "Bitcoin" */
  name: string
}

export type CoinQuote = {
  market: string
  lastPrice: number
  /** Percent; null when CoinDCX doesn't give one. */
  change24hPct: number | null
  pricedAt: string
}

const INR = "INR"
// The database columns: numeric(28,10) prices and numeric(14,4) changes.
const PRICE_DECIMALS = 10
const MAX_PRICE = 1e17
const MAX_CHANGE_PCT = 1e9

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string" || value.trim() === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function rows(json: unknown, what: string): Record<string, unknown>[] {
  if (!Array.isArray(json)) {
    throw new Error(`CoinDCX's ${what} isn't in the expected format.`)
  }
  return json.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === "object",
  )
}

/** Coins that can be traded for rupees right now. */
export function parseCoinMarkets(json: unknown): CoinRecord[] {
  const coins = new Map<string, CoinRecord>()
  for (const row of rows(json, "market list")) {
    const market = text(row.symbol)
    const symbol = text(row.target_currency_short_name)
    if (
      !market ||
      !symbol ||
      row.base_currency_short_name !== INR ||
      row.status !== "active"
    ) {
      continue
    }
    coins.set(market, {
      market,
      symbol,
      name: text(row.target_currency_name) ?? symbol,
    })
  }
  return [...coins.values()]
}

/** Latest price of every rupee market, by market. */
export function parseTicker(json: unknown): Map<string, CoinQuote> {
  const quotes = new Map<string, CoinQuote>()
  for (const row of rows(json, "ticker")) {
    const market = text(row.market)
    if (!market?.endsWith(INR)) continue

    const lastPrice = toNumber(row.last_price)
    const seconds = toNumber(row.timestamp)
    if (
      lastPrice === null ||
      lastPrice <= 0 ||
      lastPrice >= MAX_PRICE ||
      seconds === null ||
      seconds <= 0
    ) {
      continue
    }
    const change = toNumber(row.change_24_hour)
    quotes.set(market, {
      market,
      lastPrice: Number(lastPrice.toFixed(PRICE_DECIMALS)),
      change24hPct:
        change === null || Math.abs(change) >= MAX_CHANGE_PCT
          ? null
          : Number(change.toFixed(4)),
      pricedAt: new Date(seconds * 1000).toISOString(),
    })
  }
  return quotes
}
