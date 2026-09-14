// Fund search helpers. AMFI names are long ("Parag Parikh Flexi Cap Fund -
// Direct Plan - Growth"), so every typed word must appear somewhere in the name.

const MAX_WORDS = 6
// NAVs older than this belong to closed or wound-up funds.
const STALE_NAV_DAYS = 30

/** Lower-case words of letters and digits only, so they're safe in a database filter. */
export function fundSearchWords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, MAX_WORDS)
}

/** An AMFI scheme code typed on its own, e.g. "122639". */
export function parseSchemeCode(query: string): number | null {
  const trimmed = query.trim()
  return /^\d{1,7}$/.test(trimmed) ? Number(trimmed) : null
}

export function isStaleNav(navDate: string | null, today: string): boolean {
  if (!navDate) return true
  const days =
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${navDate}T00:00:00Z`)) /
    86_400_000
  return days > STALE_NAV_DAYS
}

/** Funds with a recent NAV first, then names starting with the first word, then A–Z. */
export function rankFunds<T extends { name: string; nav_date: string | null }>(
  funds: readonly T[],
  words: readonly string[],
  today: string,
  limit: number,
): T[] {
  const first = words[0] ?? ""
  const score = (fund: T) =>
    (isStaleNav(fund.nav_date, today) ? 2 : 0) +
    (first && fund.name.toLowerCase().startsWith(first) ? 0 : 1)
  return [...funds]
    .sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))
    .slice(0, limit)
}
