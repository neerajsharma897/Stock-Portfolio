import "server-only"

import { requireOwner } from "@/lib/auth"
import { fetchPrices } from "@/lib/data/prices"
import type { TransactionInstrument } from "@/lib/data/transactions"
import type { Price } from "@/lib/portfolio/valuation"
import { createClient } from "@/lib/supabase/server"

export type WatchlistItem = {
  instrument: TransactionInstrument
  note: string | null
  addedAt: string
  price: Price | null
}

export type Watchlist = {
  id: string
  name: string
  /** By symbol. */
  items: WatchlistItem[]
}

/** Every watchlist in page order, with its stocks and their latest saved prices. */
export async function listWatchlists(): Promise<Watchlist[]> {
  await requireOwner()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("watchlists")
    .select(
      "id, name, items:watchlist_items(note, created_at, instrument:instruments(id, exchange, symbol, name, series, kind))",
    )
    .order("position")
    .order("created_at")
  if (error) throw new Error(`Couldn't load watchlists: ${error.message}`)

  const prices = await fetchPrices(
    supabase,
    data.flatMap((list) => list.items.map((item) => item.instrument.id)),
  )
  return data.map((list) => ({
    id: list.id,
    name: list.name,
    items: list.items
      .map((item) => ({
        instrument: item.instrument,
        note: item.note,
        addedAt: item.created_at,
        price: prices.get(item.instrument.id) ?? null,
      }))
      .sort(
        (a, b) =>
          a.instrument.symbol.localeCompare(b.instrument.symbol) ||
          a.instrument.exchange.localeCompare(b.instrument.exchange),
      ),
  }))
}
