/** Uppercases and keeps only characters found in NSE/BSE tickers, e.g. "m&m" → "M&M". */
export function normalizeSearchQuery(query: string): string {
  return query
    .toUpperCase()
    .replace(/[^A-Z0-9&-]/g, "")
    .slice(0, 30)
}

/** Best matches first: exact symbol, then symbol prefix, then name; NSE before BSE. */
export function rankInstruments<
  T extends { symbol: string; name: string; exchange: string },
>(items: readonly T[], query: string, limit: number): T[] {
  const score = (item: T) =>
    item.symbol === query
      ? 0
      : item.symbol.startsWith(query)
        ? 1
        : item.name.startsWith(query)
          ? 2
          : 3

  return [...items]
    .sort(
      (a, b) =>
        score(a) - score(b) ||
        Number(b.exchange === "NSE") - Number(a.exchange === "NSE") ||
        a.symbol.localeCompare(b.symbol),
    )
    .slice(0, limit)
}
