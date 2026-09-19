import "server-only"

import { requireOwner } from "@/lib/auth"
import { toHoldingTransaction } from "@/lib/data/transactions"
import { groupHoldings } from "@/lib/portfolio/member-holdings"
import { readAllRows } from "@/lib/supabase/read-all"
import { createClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/lib/supabase/types"

export type NewsStock = {
  id: number
  symbol: string
  exchange: string
  /** Held by an active member right now. */
  held: boolean
  watched: boolean
  /** Name searched on Google News; null searches the symbol. */
  searchName: string | null
  checkedAt: string | null
  error: string | null
}

export type NewsArticle = {
  id: number
  url: string
  title: string
  source: string | null
  publishedAt: string
  stocks: { id: number; symbol: string }[]
}

/** Stocks that get news: held by active members, plus the watchlist. By symbol. */
export async function listNewsStocks(): Promise<NewsStock[]> {
  await requireOwner()
  return loadNewsStocks(await createClient())
}

/** Same as listNewsStocks, with any client (the news job uses the admin client). */
export async function loadNewsStocks(
  supabase: AppSupabaseClient,
): Promise<NewsStock[]> {
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id")
    .is("archived_at", null)
  if (membersError) {
    throw new Error(`Couldn't load members: ${membersError.message}`)
  }
  const memberIds = members.map((member) => member.id)

  const [transactions, watchlist, feeds] = await Promise.all([
    memberIds.length === 0
      ? []
      : readAllRows("transactions", (from, to) =>
          supabase
            .from("transactions")
            .select(
              "id, type, quantity, price, charges, trade_date, created_at, broker_account_id, instrument_id, instrument:instruments(id, symbol, exchange)",
            )
            .in("member_id", memberIds)
            .order("id")
            .range(from, to),
        ),
    supabase
      .from("watchlist_items")
      .select("instrument:instruments(id, symbol, exchange)"),
    supabase
      .from("news_feeds")
      .select("instrument_id, search_name, checked_at, error"),
  ])
  const error = watchlist.error ?? feeds.error
  if (error) throw new Error(`Couldn't load news settings: ${error.message}`)
  const watchlistRows = watchlist.data ?? []

  const instruments = new Map(
    [
      ...transactions.map((transaction) => transaction.instrument),
      ...watchlistRows.map((row) => row.instrument),
    ].map((instrument) => [instrument.id, instrument]),
  )
  const held = new Set(
    groupHoldings(transactions.map(toHoldingTransaction))
      .holdings.filter((holding) => holding.position.quantity > 0)
      .map((holding) => holding.instrumentId),
  )
  const watched = new Set(watchlistRows.map((row) => row.instrument.id))
  const feedsById = new Map(
    (feeds.data ?? []).map((feed) => [feed.instrument_id, feed]),
  )

  return [...new Set([...held, ...watched])]
    .flatMap((id) => {
      const instrument = instruments.get(id)
      if (!instrument) return []
      const feed = feedsById.get(id)
      return [
        {
          id,
          symbol: instrument.symbol,
          exchange: instrument.exchange,
          held: held.has(id),
          watched: watched.has(id),
          searchName: feed?.search_name ?? null,
          checkedAt: feed?.checked_at ?? null,
          error: feed?.error ?? null,
        },
      ]
    })
    .sort(
      (a, b) =>
        a.symbol.localeCompare(b.symbol) ||
        a.exchange.localeCompare(b.exchange),
    )
}

/** Newest headlines linked to any of the given stocks. */
export async function listNewsArticles(
  instrumentIds: readonly number[],
  limit: number,
): Promise<NewsArticle[]> {
  await requireOwner()
  if (instrumentIds.length === 0) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("news_articles")
    .select(
      "id, url, title, source, published_at, links:news_article_stocks!inner(instrument:instruments(id, symbol))",
    )
    .in("links.instrument_id", instrumentIds)
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Couldn't load news: ${error.message}`)

  return data.map((row) => ({
    id: row.id,
    url: row.url,
    title: row.title,
    source: row.source,
    publishedAt: row.published_at,
    stocks: row.links
      .map((link) => link.instrument)
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
  }))
}
