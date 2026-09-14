// Request batching and response parsing for SmartAPI's market data quote API.

export type QuoteExchange = "NSE" | "BSE"
export type QuoteRequestItem = { exchange: QuoteExchange; token: string }

export type QuoteRequestBody = {
  mode: "FULL"
  exchangeTokens: Partial<Record<QuoteExchange, string[]>>
}

export type Quote = {
  exchange: QuoteExchange
  token: string
  lastPrice: number
  /** SmartAPI's `close`: the previous trading day's close. */
  previousClose: number | null
}

/** SmartAPI returns data for at most 50 tokens per quote request. */
export const MAX_TOKENS_PER_REQUEST = 50

/** Splits instruments into request bodies of at most 50 tokens, dropping duplicates. */
export function buildQuoteBatches(
  items: readonly QuoteRequestItem[],
): QuoteRequestBody[] {
  const unique = [
    ...new Map(
      items.map((item) => [`${item.exchange}:${item.token}`, item]),
    ).values(),
  ]

  const batches: QuoteRequestBody[] = []
  for (let start = 0; start < unique.length; start += MAX_TOKENS_PER_REQUEST) {
    const exchangeTokens: QuoteRequestBody["exchangeTokens"] = {}
    for (const { exchange, token } of unique.slice(
      start,
      start + MAX_TOKENS_PER_REQUEST,
    )) {
      ;(exchangeTokens[exchange] ??= []).push(token)
    }
    batches.push({ mode: "FULL", exchangeTokens })
  }
  return batches
}

function positiveNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

/** Reads `data.fetched` from a quote response, skipping entries without a usable price. */
export function parseQuotes(data: unknown): Quote[] {
  if (!data || typeof data !== "object") return []
  const fetched = (data as { fetched?: unknown }).fetched
  if (!Array.isArray(fetched)) return []

  const quotes: Quote[] = []
  for (const entry of fetched) {
    if (!entry || typeof entry !== "object") continue
    const { exchange, symbolToken, ltp, close } = entry as Record<
      string,
      unknown
    >
    if (exchange !== "NSE" && exchange !== "BSE") continue
    if (typeof symbolToken !== "string" || symbolToken === "") continue
    const lastPrice = positiveNumber(ltp)
    if (lastPrice === null) continue
    quotes.push({
      exchange,
      token: symbolToken,
      lastPrice,
      previousClose: positiveNumber(close),
    })
  }
  return quotes
}
