// Plain-language lines for the audit log in Settings, e.g.
// "Changed FD: SBI (rate_pct, maturity_date)".

import type { Json } from "@/lib/supabase/database.types"

export type AuditEntry = {
  table_name: string
  action: string
  old_data: Json | null
  new_data: Json | null
}

const TABLE_LABELS: Record<string, string> = {
  members: "member",
  broker_accounts: "account",
  transactions: "stock entry",
  mf_transactions: "fund entry",
  crypto_transactions: "crypto entry",
  fixed_deposits: "FD",
  other_assets: "asset",
  ipo_applications: "IPO application",
  corporate_actions: "split or bonus",
  watchlists: "watchlist",
  watchlist_items: "watchlist stock",
  market_holidays: "market holiday",
}

const VERBS: Record<string, string> = {
  insert: "Added",
  update: "Changed",
  delete: "Deleted",
}

// Columns that change on every save or only link rows together.
const IGNORED = new Set(["id", "created_at", "updated_at"])

type Row = Record<string, Json | undefined>

function asRow(value: Json | null): Row | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null
}

/** The most recognisable value in a row: a name, bank, company or entry summary. */
function rowLabel(row: Row): string | null {
  for (const key of ["name", "bank", "company", "description", "label"]) {
    const value = row[key]
    if (typeof value === "string" && value) return value
  }
  const amount = row.quantity ?? row.units
  if (typeof row.type === "string" && amount !== undefined) {
    const date =
      typeof row.trade_date === "string" ? ` on ${row.trade_date}` : ""
    return `${row.type.replace(/_/g, " ")} of ${amount}${date}`
  }
  return null
}

export function describeAuditEntry(entry: AuditEntry): string {
  if (entry.action === "restore") return "Restored a backup"

  const table = TABLE_LABELS[entry.table_name] ?? entry.table_name
  const verb = VERBS[entry.action] ?? entry.action
  const oldRow = asRow(entry.old_data)
  const newRow = asRow(entry.new_data)
  const label = rowLabel(newRow ?? oldRow ?? {})

  let changed = ""
  if (entry.action === "update" && oldRow && newRow) {
    const fields = Object.keys(newRow).filter(
      (key) =>
        !IGNORED.has(key) &&
        JSON.stringify(newRow[key]) !== JSON.stringify(oldRow[key]),
    )
    if (fields.length > 0)
      changed = ` (${fields.join(", ").replace(/_/g, " ")})`
  }

  return `${verb} ${table}${label ? `: ${label}` : ""}${changed}`
}
