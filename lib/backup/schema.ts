import { z } from "zod"

import { BROKERS, MEMBER_RELATIONS } from "@/lib/members/options"
import { MF_TRANSACTION_TYPES } from "@/lib/mutual-funds/options"
import { TRANSACTION_TYPES } from "@/lib/transactions/options"

// Backup file format. Rows use the database column names; stocks are referenced
// by exchange and Angel One token (plus symbol, for reading) because instrument
// ids differ between databases. Mutual funds use the AMFI code, which doesn't.
// Version 2 adds mutual fund entries; version 3 adds crypto entries (by CoinDCX
// market), the watchlist and news search names; version 4 adds named watchlists.
// Older files still restore (a version 3 watchlist becomes "Watchlist 1").

export const BACKUP_APP = "family-portfolio"
export const BACKUP_VERSION = 4

const timestamp = z.string().min(1)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const nullableText = z.string().nullable()
const stockRef = {
  exchange: z.enum(["NSE", "BSE"]),
  token: z.string().min(1),
  symbol: z.string(),
}

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(BACKUP_VERSION),
  ]),
  exportedAt: timestamp,
  members: z.array(
    z.object({
      id: z.uuid(),
      name: z.string().min(1),
      relation: z.enum(MEMBER_RELATIONS),
      color: z.string(),
      pan_last4: nullableText,
      notes: nullableText,
      archived_at: timestamp.nullable(),
      created_at: timestamp,
      updated_at: timestamp,
    }),
  ),
  brokerAccounts: z.array(
    z.object({
      id: z.uuid(),
      member_id: z.uuid(),
      broker: z.enum(BROKERS),
      label: nullableText,
      client_id_last4: nullableText,
      notes: nullableText,
      created_at: timestamp,
      updated_at: timestamp,
    }),
  ),
  transactions: z.array(
    z.object({
      id: z.uuid(),
      member_id: z.uuid(),
      broker_account_id: z.uuid(),
      ...stockRef,
      type: z.enum(TRANSACTION_TYPES),
      quantity: z.number().positive(),
      price: z.number().positive(),
      charges: z.number().nonnegative(),
      trade_date: isoDate,
      notes: nullableText,
      created_at: timestamp,
      updated_at: timestamp,
    }),
  ),
  mfTransactions: z
    .array(
      z.object({
        id: z.uuid(),
        member_id: z.uuid(),
        broker_account_id: z.uuid(),
        amfi_code: z.number().int().positive(),
        folio_number: nullableText,
        type: z.enum(MF_TRANSACTION_TYPES),
        units: z.number().positive(),
        nav: z.number().positive(),
        charges: z.number().nonnegative(),
        trade_date: isoDate,
        notes: nullableText,
        created_at: timestamp,
        updated_at: timestamp,
      }),
    )
    .default([]),
  cryptoTransactions: z
    .array(
      z.object({
        id: z.uuid(),
        member_id: z.uuid(),
        broker_account_id: z.uuid(),
        market: z.string().min(1),
        type: z.enum(TRANSACTION_TYPES),
        quantity: z.number().positive(),
        price: z.number().positive(),
        charges: z.number().nonnegative(),
        trade_date: isoDate,
        notes: nullableText,
        created_at: timestamp,
        updated_at: timestamp,
      }),
    )
    .default([]),
  watchlists: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string().min(1),
        position: z.number().int(),
        created_at: timestamp,
        updated_at: timestamp,
      }),
    )
    .default([]),
  watchlist: z
    .array(
      z.object({
        /** Missing in version 3, which had a single watchlist. */
        watchlist_id: z.uuid().optional(),
        ...stockRef,
        note: nullableText,
        created_at: timestamp,
        updated_at: timestamp,
      }),
    )
    .default([]),
  newsSearches: z
    .array(z.object({ ...stockRef, search_name: z.string().min(1) }))
    .default([]),
  instrumentPrices: z.array(
    z.object({
      ...stockRef,
      last_price: z.number().positive(),
      previous_close: z.number().positive().nullable(),
      source: z.enum(["manual", "angelone"]),
      priced_at: timestamp,
      updated_at: timestamp,
    }),
  ),
  marketHolidays: z.array(
    z.object({
      holiday_date: isoDate,
      description: z.string().min(1),
      created_at: timestamp,
    }),
  ),
  eodPrices: z.array(
    z.object({
      ...stockRef,
      price_date: isoDate,
      close_price: z.number().positive(),
      created_at: timestamp,
    }),
  ),
  portfolioSnapshots: z.array(
    z.object({
      member_id: z.uuid(),
      snapshot_date: isoDate,
      holding_count: z.number().int().nonnegative(),
      priced_count: z.number().int().nonnegative(),
      invested: z.number(),
      current_value: z.number(),
      unrealized_pnl: z.number(),
      realized_pnl: z.number(),
      created_at: timestamp,
    }),
  ),
})

export type Backup = z.infer<typeof backupSchema>

export type BackupCounts = {
  members: number
  brokerAccounts: number
  transactions: number
  fundEntries: number
  cryptoEntries: number
  watchlists: number
  watchlist: number
  prices: number
  holidays: number
  closingPrices: number
  snapshots: number
}

export function countBackup(backup: Backup): BackupCounts {
  return {
    members: backup.members.length,
    brokerAccounts: backup.brokerAccounts.length,
    transactions: backup.transactions.length,
    fundEntries: backup.mfTransactions.length,
    cryptoEntries: backup.cryptoTransactions.length,
    watchlists: backup.watchlists.length,
    watchlist: backup.watchlist.length,
    prices: backup.instrumentPrices.length,
    holidays: backup.marketHolidays.length,
    closingPrices: backup.eodPrices.length,
    snapshots: backup.portfolioSnapshots.length,
  }
}

/** Every distinct stock the backup refers to. */
export function stockRefs(
  backup: Backup,
): { exchange: "NSE" | "BSE"; token: string; symbol: string }[] {
  const refs = new Map<
    string,
    { exchange: "NSE" | "BSE"; token: string; symbol: string }
  >()
  for (const row of [
    ...backup.transactions,
    ...backup.instrumentPrices,
    ...backup.eodPrices,
    ...backup.watchlist,
    ...backup.newsSearches,
  ]) {
    refs.set(`${row.exchange}:${row.token}`, {
      exchange: row.exchange,
      token: row.token,
      symbol: row.symbol,
    })
  }
  return [...refs.values()]
}

/** Every distinct mutual fund (AMFI code) the backup refers to. */
export function fundRefs(backup: Backup): number[] {
  return [...new Set(backup.mfTransactions.map((row) => row.amfi_code))]
}

/** Every distinct coin (CoinDCX market) the backup refers to. */
export function coinRefs(backup: Backup): string[] {
  return [...new Set(backup.cryptoTransactions.map((row) => row.market))]
}
