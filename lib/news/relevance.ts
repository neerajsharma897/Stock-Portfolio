// Which Google News results belong to a stock. Searching a ticker like RELIANCE
// also finds Reliance Power and "share price today" quote pages, so a headline
// must name the stock (its symbol, or a search name set on the News page) and
// quote pages are dropped.

import type { NewsItem } from "@/lib/news/google-news"

const LOOKBACK_DAYS = 7

/** The name searched for a stock: the one set on the News page, or the symbol. */
export function newsSearchName(
  symbol: string,
  searchName: string | null,
): string {
  return (searchName ?? symbol).replace(/["]/g, "").trim()
}

/** Google News RSS search for the past week, in Indian English. */
export function googleNewsUrl(name: string): string {
  const params = new URLSearchParams({
    q: `"${name}" (share OR shares OR stock) when:${LOOKBACK_DAYS}d`,
    hl: "en-IN",
    gl: "IN",
    ceid: "IN:en",
  })
  return `https://news.google.com/rss/search?${params}`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** True when the headline contains the name as whole words, e.g. "HDFC Bank's" for "HDFC Bank". */
export function mentionsName(title: string, name: string): boolean {
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9&]+/)
    .filter(Boolean)
  if (words.length === 0) return false
  const pattern = new RegExp(
    `(^|[^a-z0-9])${words.map(escapeRegExp).join("[^a-z0-9]+")}($|[^a-z0-9])`,
  )
  return pattern.test(title.toLowerCase())
}

const QUOTE_PAGE =
  /\b(share|stock) price (today|live)\b|\blive (chart|nse|bse)\b|\bprice prediction\b|\boption chain\b|\boutlook for the week\b|\bdividend history\b/i

/** Price pages and daily predictions that show up in news search but aren't news. */
export function isQuotePage(title: string): boolean {
  return QUOTE_PAGE.test(title)
}

export function isRelevantNews(item: NewsItem, name: string): boolean {
  return mentionsName(item.title, name) && !isQuotePage(item.title)
}
