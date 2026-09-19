import "server-only"

import { z } from "zod"

import { requireOwner } from "@/lib/auth"
import type {
  CoinPrice,
  CryptoTransactionForHolding,
} from "@/lib/crypto/portfolio"
import { normalizeCoinQuery, rankCoins } from "@/lib/crypto/search"
import type { Tables } from "@/lib/supabase/database.types"
import { readAllRows } from "@/lib/supabase/read-all"
import { createClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/lib/supabase/types"

export type Coin = Pick<
  Tables<"crypto_assets">,
  | "market"
  | "symbol"
  | "name"
  | "last_price"
  | "change_24h_pct"
  | "priced_at"
  | "is_active"
>
export type CoinOption = Pick<
  Coin,
  "market" | "symbol" | "name" | "last_price" | "priced_at"
>
export type CryptoTransaction = Tables<"crypto_transactions">
export type CryptoTransactionWithCoin = CryptoTransaction & { coin: Coin }

const CANDIDATE_LIMIT = 60
const RESULT_LIMIT = 15

/** Database row → the shape the holdings calculator uses. */
export function toCryptoHoldingTransaction(
  row: Pick<
    CryptoTransaction,
    | "id"
    | "type"
    | "quantity"
    | "price"
    | "charges"
    | "trade_date"
    | "created_at"
    | "broker_account_id"
    | "market"
  >,
): CryptoTransactionForHolding {
  return {
    id: row.id,
    type: row.type,
    quantity: Number(row.quantity),
    price: Number(row.price),
    charges: Number(row.charges),
    tradeDate: row.trade_date,
    createdAt: row.created_at,
    brokerAccountId: row.broker_account_id,
    market: row.market,
  }
}

export function toCoinPrice(
  coin: Pick<Coin, "last_price" | "change_24h_pct" | "priced_at"> | undefined,
): CoinPrice | null {
  if (!coin || coin.last_price === null || !coin.priced_at) return null
  return {
    lastPrice: Number(coin.last_price),
    change24hPct:
      coin.change_24h_pct === null ? null : Number(coin.change_24h_pct),
    pricedAt: coin.priced_at,
  }
}

/** A member's crypto entries with their coin, newest first. */
export async function listMemberCryptoTransactions(
  memberId: string,
): Promise<CryptoTransactionWithCoin[]> {
  await requireOwner()
  if (!z.uuid().safeParse(memberId).success) return []

  const supabase = await createClient()
  return readAllRows("crypto entries", (from, to) =>
    supabase
      .from("crypto_transactions")
      .select(
        "*, coin:crypto_assets(market, symbol, name, last_price, change_24h_pct, priced_at, is_active)",
      )
      .eq("member_id", memberId)
      .order("trade_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  )
}

/** Every crypto entry of the given members, for family totals and scheduled jobs. */
export async function fetchCryptoTransactions(
  supabase: AppSupabaseClient,
  memberIds: readonly string[],
) {
  if (memberIds.length === 0) return []
  return readAllRows("crypto entries", (from, to) =>
    supabase
      .from("crypto_transactions")
      .select(
        "id, type, quantity, price, charges, trade_date, created_at, broker_account_id, market, member_id, coin:crypto_assets(market, symbol, name, last_price, change_24h_pct, priced_at, is_active)",
      )
      .in("member_id", memberIds)
      .order("id")
      .range(from, to),
  )
}

/** Coins traded for rupees matching a symbol or name, best matches first. */
export async function searchCoins(rawQuery: string): Promise<CoinOption[]> {
  await requireOwner()

  const query = normalizeCoinQuery(rawQuery)
  if (query.length < 2) return []

  const supabase = await createClient()
  const activeCoins = () =>
    supabase
      .from("crypto_assets")
      .select("market, symbol, name, last_price, priced_at")
      .eq("is_active", true)

  const [symbolMatches, nameMatches] = await Promise.all([
    activeCoins()
      .ilike("symbol", `${query}%`)
      .order("symbol")
      .limit(CANDIDATE_LIMIT),
    activeCoins()
      .ilike("name", `%${query}%`)
      .order("symbol")
      .limit(CANDIDATE_LIMIT),
  ])
  const error = symbolMatches.error ?? nameMatches.error
  if (error) throw new Error(`Couldn't search coins: ${error.message}`)

  const unique = new Map(
    [...(symbolMatches.data ?? []), ...(nameMatches.data ?? [])].map((coin) => [
      coin.market,
      coin,
    ]),
  )
  return rankCoins([...unique.values()], query, RESULT_LIMIT)
}

export type CoinListStatus = { count: number; lastUpdated: string | null }

/** How many coins can be picked, and when the list was last downloaded. */
export async function getCoinListStatus(): Promise<CoinListStatus> {
  await requireOwner()

  const supabase = await createClient()
  const [countResult, latestResult] = await Promise.all([
    supabase
      .from("crypto_assets")
      .select("market", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("crypto_assets")
      .select("last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const error = countResult.error ?? latestResult.error
  if (error) {
    throw new Error(`Couldn't load the coin list status: ${error.message}`)
  }
  return {
    count: countResult.count ?? 0,
    lastUpdated: latestResult.data?.last_seen_at ?? null,
  }
}
