// Coin search: by symbol ("BTC") or name ("bitcoin").

const MAX_QUERY_LENGTH = 30

/** Letters, digits and spaces only, so the query is safe in a database filter. */
export function normalizeCoinQuery(query: string): string {
  return query
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
}

/**
 * Exact symbol first, then symbols starting with the query, then exact names,
 * then names starting with it; shorter symbols first within each.
 */
export function rankCoins<T extends { symbol: string; name: string }>(
  coins: readonly T[],
  query: string,
  limit: number,
): T[] {
  const wanted = query.toUpperCase()
  const score = (coin: T) => {
    const symbol = coin.symbol.toUpperCase()
    const name = coin.name.toUpperCase()
    if (symbol === wanted) return 0
    if (symbol.startsWith(wanted)) return 1
    if (name === wanted) return 2
    if (name.startsWith(wanted)) return 3
    return 4
  }
  return [...coins]
    .sort(
      (a, b) =>
        score(a) - score(b) ||
        a.symbol.length - b.symbol.length ||
        a.symbol.localeCompare(b.symbol),
    )
    .slice(0, limit)
}
