import "server-only"

import { BACKUP_APP, BACKUP_VERSION, type Backup } from "@/lib/backup/schema"
import { readAllRows } from "@/lib/supabase/read-all"
import type { AppSupabaseClient } from "@/lib/supabase/types"

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
    mfTransactions,
    cryptoTransactions,
    watchlists,
    watchlist,
    newsSearches,
    corporateActions,
    fixedDeposits,
    otherAssets,
    ipoApplications,
    instrumentPrices,
    marketHolidays,
    eodPrices,
    portfolioSnapshots,
  ] = await Promise.all([
    readAllRows("members", (from, to) =>
      supabase
        .from("members")
        .select(
          "id, name, relation, color, pan_last4, notes, archived_at, created_at, updated_at",
        )
        .order("id")
        .range(from, to),
    ),
    readAllRows("broker accounts", (from, to) =>
      supabase
        .from("broker_accounts")
        .select(
          "id, member_id, broker, label, client_id_last4, notes, created_at, updated_at",
        )
        .order("id")
        .range(from, to),
    ),
    readAllRows("transactions", (from, to) =>
      supabase
        .from("transactions")
        .select(
          "id, member_id, broker_account_id, type, quantity, price, charges, trade_date, notes, created_at, updated_at, instrument:instruments(exchange, token, symbol)",
        )
        .order("id")
        .range(from, to),
    ),
    readAllRows("mutual fund entries", (from, to) =>
      supabase
        .from("mf_transactions")
        .select(
          "id, member_id, broker_account_id, amfi_code, folio_number, type, units, nav, charges, trade_date, notes, created_at, updated_at",
        )
        .order("id")
        .range(from, to),
    ),
    readAllRows("crypto entries", (from, to) =>
      supabase
        .from("crypto_transactions")
        .select(
          "id, member_id, broker_account_id, market, type, quantity, price, charges, trade_date, notes, created_at, updated_at",
        )
        .order("id")
        .range(from, to),
    ),
    readAllRows("watchlists", (from, to) =>
      supabase
        .from("watchlists")
        .select("id, name, position, created_at, updated_at")
        .order("id")
        .range(from, to),
    ),
    readAllRows("watchlist stocks", (from, to) =>
      supabase
        .from("watchlist_items")
        .select(
          "watchlist_id, note, created_at, updated_at, instrument:instruments(exchange, token, symbol)",
        )
        .order("watchlist_id")
        .order("instrument_id")
        .range(from, to),
    ),
    readAllRows("news search names", (from, to) =>
      supabase
        .from("news_feeds")
        .select("search_name, instrument:instruments(exchange, token, symbol)")
        .not("search_name", "is", null)
        .order("instrument_id")
        .range(from, to),
    ),
    readAllRows("splits and bonuses", (from, to) =>
      supabase
        .from("corporate_actions")
        .select(
          "id, kind, ex_date, ratio_from, ratio_to, notes, created_at, updated_at, instrument:instruments(exchange, token, symbol)",
        )
        .order("id")
        .range(from, to),
    ),
    readAllRows("fixed deposits", (from, to) =>
      supabase
        .from("fixed_deposits")
        .select(
          "id, member_id, bank, principal, rate_pct, interest, start_date, maturity_date, closed_on, notes, created_at, updated_at",
        )
        .order("id")
        .range(from, to),
    ),
    readAllRows("other assets", (from, to) =>
      supabase
        .from("other_assets")
        .select(
          "id, member_id, kind, name, invested, current_value, value_as_of, notes, created_at, updated_at",
        )
        .order("id")
        .range(from, to),
    ),
    readAllRows("IPO applications", (from, to) =>
      supabase
        .from("ipo_applications")
        .select(
          "id, member_id, company, applied_on, shares_applied, price, status, shares_allotted, notes, created_at, updated_at",
        )
        .order("id")
        .range(from, to),
    ),
    readAllRows("prices", (from, to) =>
      supabase
        .from("instrument_prices")
        .select(
          "last_price, previous_close, source, priced_at, updated_at, instrument:instruments(exchange, token, symbol)",
        )
        .order("instrument_id")
        .range(from, to),
    ),
    readAllRows("holidays", (from, to) =>
      supabase
        .from("market_holidays")
        .select("holiday_date, description, created_at")
        .order("holiday_date")
        .range(from, to),
    ),
    readAllRows("closing prices", (from, to) =>
      supabase
        .from("eod_prices")
        .select(
          "price_date, close_price, created_at, instrument:instruments(exchange, token, symbol)",
        )
        .order("instrument_id")
        .order("price_date")
        .range(from, to),
    ),
    readAllRows("snapshots", (from, to) =>
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
    mfTransactions,
    cryptoTransactions,
    watchlists,
    watchlist: watchlist.map(withStockRef),
    newsSearches: newsSearches.flatMap(({ search_name, ...row }) =>
      search_name ? [{ ...withStockRef(row), search_name }] : [],
    ),
    corporateActions: corporateActions.map(withStockRef),
    fixedDeposits,
    otherAssets,
    ipoApplications,
    instrumentPrices: instrumentPrices.map(withStockRef),
    marketHolidays,
    eodPrices: eodPrices.map(withStockRef),
    portfolioSnapshots,
  }
}
