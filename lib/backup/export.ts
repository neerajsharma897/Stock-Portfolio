import "server-only"

import { BACKUP_APP, BACKUP_VERSION, type Backup } from "@/lib/backup/schema"
import type { AppSupabaseClient } from "@/lib/supabase/types"

// Supabase's API returns at most 1,000 rows per request.
const PAGE_SIZE = 1000

type Page<T> = PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>

async function readAll<T>(
  label: string,
  fetchPage: (from: number, to: number) => Page<T>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Couldn't export ${label}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

type StockRow = {
  instrument: { exchange: "NSE" | "BSE"; token: string; symbol: string }
}

/** Replaces the embedded instrument with exchange, token and symbol. */
function withStockRef<T extends StockRow>(row: T) {
  const { instrument, ...rest } = row
  return {
    ...rest,
    exchange: instrument.exchange,
    token: instrument.token,
    symbol: instrument.symbol,
  }
}

/**
 * Everything entered in the app as one backup object. Pass the owner's client
 * (after requireOwner()) or the admin client for the GitHub backup.
 */
export async function buildBackup(
  supabase: AppSupabaseClient,
): Promise<Backup> {
  const [
    members,
    brokerAccounts,
    transactions,
    instrumentPrices,
    marketHolidays,
    eodPrices,
    portfolioSnapshots,
  ] = await Promise.all([
    readAll("members", (from, to) =>
      supabase
        .from("members")
        .select(
          "id, name, relation, color, pan_last4, notes, archived_at, created_at, updated_at",
        )
        .order("id")
        .range(from, to),
    ),
    readAll("broker accounts", (from, to) =>
      supabase
        .from("broker_accounts")
        .select(
          "id, member_id, broker, label, client_id_last4, notes, created_at, updated_at",
        )
        .order("id")
        .range(from, to),
    ),
    readAll("transactions", (from, to) =>
      supabase
        .from("transactions")
        .select(
          "id, member_id, broker_account_id, type, quantity, price, charges, trade_date, notes, created_at, updated_at, instrument:instruments(exchange, token, symbol)",
        )
        .order("id")
        .range(from, to),
    ),
    readAll("prices", (from, to) =>
      supabase
        .from("instrument_prices")
        .select(
          "last_price, previous_close, source, priced_at, updated_at, instrument:instruments(exchange, token, symbol)",
        )
        .order("instrument_id")
        .range(from, to),
    ),
    readAll("holidays", (from, to) =>
      supabase
        .from("market_holidays")
        .select("holiday_date, description, created_at")
        .order("holiday_date")
        .range(from, to),
    ),
    readAll("closing prices", (from, to) =>
      supabase
        .from("eod_prices")
        .select(
          "price_date, close_price, created_at, instrument:instruments(exchange, token, symbol)",
        )
        .order("instrument_id")
        .order("price_date")
        .range(from, to),
    ),
    readAll("snapshots", (from, to) =>
      supabase
        .from("portfolio_snapshots")
        .select(
          "member_id, snapshot_date, holding_count, priced_count, invested, current_value, unrealized_pnl, realized_pnl, created_at",
        )
        .order("member_id")
        .order("snapshot_date")
        .range(from, to),
    ),
  ])

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    members,
    brokerAccounts,
    transactions: transactions.map(withStockRef),
    instrumentPrices: instrumentPrices.map(withStockRef),
    marketHolidays,
    eodPrices: eodPrices.map(withStockRef),
    portfolioSnapshots,
  }
}
