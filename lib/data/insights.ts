import "server-only"

import { requireOwner } from "@/lib/auth"
import type { Tables } from "@/lib/supabase/database.types"
import { readAllRows } from "@/lib/supabase/read-all"
import { createClient } from "@/lib/supabase/server"

export type SectorInfo = {
  /** Sector by stock symbol, for the symbols asked for. */
  bySymbol: Map<string, string>
  /** NSE's list has been downloaded at least once. */
  loaded: boolean
  /** The sectors migration hasn't been run yet. */
  missing: boolean
}

// PostgREST's "table not in the schema cache" and Postgres's "no such table".
const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01"])

export async function getSectors(
  symbols: readonly string[],
): Promise<SectorInfo> {
  await requireOwner()
  const supabase = await createClient()
  const [rows, loaded] = await Promise.all([
    symbols.length === 0
      ? { data: [], error: null }
      : supabase
          .from("stock_sectors")
          .select("symbol, sector")
          .in("symbol", [...new Set(symbols)]),
    supabase
      .from("stock_sectors")
      .select("symbol")
      .eq("source", "nse")
      .limit(1),
  ])
  const error = rows.error ?? loaded.error
  if (error) {
    // Sectors are extra: without the table the rest of the page still works.
    if (MISSING_TABLE_CODES.has(error.code)) {
      return { bySymbol: new Map(), loaded: false, missing: true }
    }
    throw new Error(`Couldn't load sectors: ${error.message}`)
  }
  return {
    bySymbol: new Map((rows.data ?? []).map((row) => [row.symbol, row.sector])),
    loaded: (loaded.data?.length ?? 0) > 0,
    missing: false,
  }
}

export type BrokerAccount = Pick<
  Tables<"broker_accounts">,
  "id" | "broker" | "label" | "member_id"
>

export async function listBrokerAccounts(): Promise<
  Map<string, BrokerAccount>
> {
  await requireOwner()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("broker_accounts")
    .select("id, broker, label, member_id")
  if (error) throw new Error(`Couldn't load broker accounts: ${error.message}`)
  return new Map(data.map((account) => [account.id, account]))
}

export type ValuePoint = {
  /** YYYY-MM-DD */
  date: string
  value: number
  invested: number
}

/**
 * The family's total value and money invested at each trading day's close,
 * from the daily snapshots of these members (saved since Stage 7).
 */
export async function getValueHistory(
  memberIds: readonly string[],
): Promise<ValuePoint[]> {
  await requireOwner()
  if (memberIds.length === 0) return []

  const supabase = await createClient()
  const rows = await readAllRows("daily snapshots", (from, to) =>
    supabase
      .from("portfolio_snapshots")
      .select("snapshot_date, current_value, invested")
      .in("member_id", [...memberIds])
      .order("snapshot_date")
      .order("member_id")
      .range(from, to),
  )

  const byDate = new Map<string, ValuePoint>()
  for (const row of rows) {
    const point = byDate.get(row.snapshot_date) ?? {
      date: row.snapshot_date,
      value: 0,
      invested: 0,
    }
    point.value += Number(row.current_value)
    point.invested += Number(row.invested)
    byDate.set(row.snapshot_date, point)
  }
  return [...byDate.values()]
}
