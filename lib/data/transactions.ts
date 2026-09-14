import "server-only"

import { z } from "zod"

import { requireOwner } from "@/lib/auth"
import type { TransactionForHolding } from "@/lib/portfolio/member-holdings"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export type Transaction = Tables<"transactions">
export type TransactionInstrument = Pick<
  Tables<"instruments">,
  "id" | "exchange" | "symbol" | "name" | "series" | "kind"
>
export type TransactionWithInstrument = Transaction & {
  instrument: TransactionInstrument
}

/** Database row → the shape the holdings calculator uses. */
export function toHoldingTransaction(
  row: Pick<
    Transaction,
    | "id"
    | "type"
    | "quantity"
    | "price"
    | "charges"
    | "trade_date"
    | "created_at"
    | "broker_account_id"
    | "instrument_id"
  >,
): TransactionForHolding {
  return {
    id: row.id,
    type: row.type,
    quantity: Number(row.quantity),
    price: Number(row.price),
    charges: Number(row.charges),
    tradeDate: row.trade_date,
    createdAt: row.created_at,
    brokerAccountId: row.broker_account_id,
    instrumentId: row.instrument_id,
  }
}

/** A member's transactions with their stock, newest first. */
export async function listMemberTransactions(
  memberId: string,
): Promise<TransactionWithInstrument[]> {
  await requireOwner()
  if (!z.uuid().safeParse(memberId).success) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "*, instrument:instruments(id, exchange, symbol, name, series, kind)",
    )
    .eq("member_id", memberId)
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw new Error(`Couldn't load transactions: ${error.message}`)
  return data
}
