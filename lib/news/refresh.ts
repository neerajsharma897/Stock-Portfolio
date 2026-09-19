import "server-only"

import { loadNewsStocks, type NewsStock } from "@/lib/data/news"
import { parseGoogleNewsRss, type NewsItem } from "@/lib/news/google-news"
import {
  googleNewsUrl,
  isRelevantNews,
  newsSearchName,
} from "@/lib/news/relevance"
import { readAllRows } from "@/lib/supabase/read-all"
import type { AppSupabaseClient } from "@/lib/supabase/types"

/** Opening the News page searches again for stocks checked longer ago than this. */
export const NEWS_STALE_MINUTES = 30

const FETCH_TIMEOUT_MS = 15_000
// A few searches at a time keeps Google from rate limiting a burst.
const CONCURRENCY = 4
// No new searches after this, so a run fits within a 60-second function.
const TIME_BUDGET_MS = 40_000
// Only headline, link, source and date are stored, and only this long, so the
// news tables stay well under 1 MB on Supabase's free tier.
const KEEP_DAYS = 14
const MAX_ARTICLES_PER_STOCK = 10
const DELETE_CHUNK = 200
const DAY_MS = 86_400_000

export type NewsRefreshSummary = {
  /** Stocks that get news (held or on the watchlist). */
  stocks: number
  searched: number
  /** Headlines saved or updated. */
  articles: number
  failed: number
  /** Due for a search but left for next time (out of time). */
  postponed: number
  firstError: string | null
}

/** True when a stock's news hasn't been checked within `maxAgeMinutes`. */
export function isNewsDue(
  checkedAt: string | null,
  maxAgeMinutes: number,
  now: number = Date.now(),
): boolean {
  return !checkedAt || Date.parse(checkedAt) < now - maxAgeMinutes * 60_000
}

async function saveArticles(
  supabase: AppSupabaseClient,
  instrumentId: number,
  items: readonly NewsItem[],
): Promise<number> {
  // The same link twice in one upsert is an error, so keep each once.
  const unique = [...new Map(items.map((item) => [item.url, item])).values()]
  if (unique.length === 0) return 0

  const { data, error } = await supabase
    .from("news_articles")
    .upsert(
      unique.map((item) => ({
        url: item.url,
        title: item.title,
        source: item.source,
        published_at: item.publishedAt,
      })),
      { onConflict: "url" },
    )
    .select("id")
  if (error) throw new Error(`Couldn't save headlines: ${error.message}`)

  const { error: linkError } = await supabase
    .from("news_article_stocks")
    .upsert(
      data.map((row) => ({ article_id: row.id, instrument_id: instrumentId })),
      { onConflict: "article_id,instrument_id", ignoreDuplicates: true },
    )
  if (linkError) {
    throw new Error(`Couldn't link headlines: ${linkError.message}`)
  }
  return data.length
}

/** Searches Google News for one stock, saves matching headlines and records the check. */
async function searchStock(
  supabase: AppSupabaseClient,
  stock: NewsStock,
): Promise<{ saved: number; error: string | null }> {
  const name = newsSearchName(stock.symbol, stock.searchName)
  let saved = 0
  let problem: string | null = null

  try {
    const response = await fetch(googleNewsUrl(name), {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`Google News returned HTTP ${response.status}.`)
    }
    const oldest = Date.now() - KEEP_DAYS * DAY_MS
    const items = parseGoogleNewsRss(await response.text())
      .filter(
        (item) =>
          isRelevantNews(item, name) && Date.parse(item.publishedAt) > oldest,
      )
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, MAX_ARTICLES_PER_STOCK)
    saved = await saveArticles(supabase, stock.id, items)
  } catch (error) {
    problem = error instanceof Error ? error.message : String(error)
  }

  // Only these columns, so a search name saved meanwhile isn't overwritten.
  const { error } = await supabase.from("news_feeds").upsert(
    {
      instrument_id: stock.id,
      checked_at: new Date().toISOString(),
      error: problem,
    },
    { onConflict: "instrument_id" },
  )
  if (error && !problem) {
    problem = `Couldn't save the news check: ${error.message}`
  }
  return { saved, error: problem }
}

/**
 * Searches Google News for stocks not checked in the last `maxAgeMinutes`
 * (oldest check first), then prunes stored headlines (see pruneNews). Pass the
 * owner's client (after requireOwner()) or the admin client in the news job.
 */
export async function refreshNews(
  supabase: AppSupabaseClient,
  {
    maxAgeMinutes,
    instrumentIds,
  }: { maxAgeMinutes: number; instrumentIds?: readonly number[] },
): Promise<NewsRefreshSummary> {
  const started = Date.now()
  const followed = await loadNewsStocks(supabase)
  const stocks = followed.filter(
    (stock) => !instrumentIds || instrumentIds.includes(stock.id),
  )
  const queue = stocks
    .filter((stock) => isNewsDue(stock.checkedAt, maxAgeMinutes, started))
    .sort((a, b) => (a.checkedAt ?? "").localeCompare(b.checkedAt ?? ""))
  const due = queue.length

  const summary: NewsRefreshSummary = {
    stocks: stocks.length,
    searched: 0,
    articles: 0,
    failed: 0,
    postponed: 0,
    firstError: null,
  }

  async function worker() {
    while (queue.length > 0 && Date.now() - started < TIME_BUDGET_MS) {
      const stock = queue.shift()!
      const result = await searchStock(supabase, stock)
      summary.searched += 1
      summary.articles += result.saved
      if (result.error) {
        summary.failed += 1
        summary.firstError ??= `${stock.symbol}: ${result.error}`
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  summary.postponed = due - summary.searched

  await pruneNews(
    supabase,
    followed.map((stock) => stock.id),
    started,
  )
  return summary
}

/**
 * Keeps the news tables small: deletes headlines older than two weeks, links to
 * stocks nobody holds or watches any more (and their news checks, unless a
 * search name was set), then headlines no stock links to.
 */
async function pruneNews(
  supabase: AppSupabaseClient,
  followedIds: readonly number[],
  now: number,
) {
  const followedList = `(${followedIds.join(",")})`
  const [old, links, feeds] = await Promise.all([
    supabase
      .from("news_articles")
      .delete()
      .lt("published_at", new Date(now - KEEP_DAYS * DAY_MS).toISOString()),
    followedIds.length > 0
      ? supabase
          .from("news_article_stocks")
          .delete()
          .not("instrument_id", "in", followedList)
      : supabase.from("news_article_stocks").delete().gt("instrument_id", 0),
    followedIds.length > 0
      ? supabase
          .from("news_feeds")
          .delete()
          .is("search_name", null)
          .not("instrument_id", "in", followedList)
      : supabase.from("news_feeds").delete().is("search_name", null),
  ])
  const error = old.error ?? links.error ?? feeds.error
  if (error) throw new Error(`Couldn't tidy stored news: ${error.message}`)

  const [articles, linked] = await Promise.all([
    readAllRows("headlines", (from, to) =>
      supabase.from("news_articles").select("id").order("id").range(from, to),
    ),
    readAllRows("headline links", (from, to) =>
      supabase
        .from("news_article_stocks")
        .select("article_id")
        .order("article_id")
        .order("instrument_id")
        .range(from, to),
    ),
  ])
  const linkedIds = new Set(linked.map((link) => link.article_id))
  const orphans = articles
    .map((article) => article.id)
    .filter((id) => !linkedIds.has(id))
  for (let start = 0; start < orphans.length; start += DELETE_CHUNK) {
    const { error: orphanError } = await supabase
      .from("news_articles")
      .delete()
      .in("id", orphans.slice(start, start + DELETE_CHUNK))
    if (orphanError) {
      throw new Error(
        `Couldn't delete unused headlines: ${orphanError.message}`,
      )
    }
  }
}
