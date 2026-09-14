import "server-only"

import { z } from "zod"

import { requireOwner } from "@/lib/auth"
import { todayInIndia } from "@/lib/dates"
import { toHoldingType } from "@/lib/mutual-funds/options"
import type {
  FundNav,
  FundTransactionForHolding,
} from "@/lib/mutual-funds/portfolio"
import {
  fundSearchWords,
  parseSchemeCode,
  rankFunds,
} from "@/lib/mutual-funds/search"
import type { Tables } from "@/lib/supabase/database.types"
import { readAllRows } from "@/lib/supabase/read-all"
import { createClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/lib/supabase/types"

export type FundScheme = Pick<
  Tables<"mf_schemes">,
  | "amfi_code"
  | "name"
  | "amc"
  | "category"
  | "plan"
  | "option_type"
  | "option_label"
  | "nav"
  | "nav_date"
  | "previous_nav"
  | "is_active"
>
export type FundTransaction = Tables<"mf_transactions">
export type FundTransactionWithScheme = FundTransaction & { scheme: FundScheme }
export type FundOption = Pick<
  FundScheme,
  | "amfi_code"
  | "name"
  | "amc"
  | "plan"
  | "option_type"
  | "option_label"
  | "nav"
  | "nav_date"
>

const CANDIDATE_LIMIT = 100
const RESULT_LIMIT = 25

/** Database row → the shape the holdings calculator uses. */
export function toFundHoldingTransaction(
  row: Pick<
    FundTransaction,
    | "id"
    | "type"
    | "units"
    | "nav"
    | "charges"
    | "trade_date"
    | "created_at"
    | "broker_account_id"
    | "amfi_code"
  >,
): FundTransactionForHolding {
  return {
    id: row.id,
    type: toHoldingType(row.type),
    quantity: Number(row.units),
    price: Number(row.nav),
    charges: Number(row.charges),
    tradeDate: row.trade_date,
    createdAt: row.created_at,
    brokerAccountId: row.broker_account_id,
    amfiCode: row.amfi_code,
  }
}

export function toFundNav(
  scheme: Pick<FundScheme, "nav" | "nav_date" | "previous_nav"> | undefined,
): FundNav | null {
  if (!scheme || scheme.nav === null || !scheme.nav_date) return null
  return {
    nav: Number(scheme.nav),
    navDate: scheme.nav_date,
    previousNav:
      scheme.previous_nav === null ? null : Number(scheme.previous_nav),
  }
}

/** A member's fund entries with their fund, newest first. */
export async function listMemberFundTransactions(
  memberId: string,
): Promise<FundTransactionWithScheme[]> {
  await requireOwner()
  if (!z.uuid().safeParse(memberId).success) return []

  const supabase = await createClient()
  return readAllRows("mutual fund entries", (from, to) =>
    supabase
      .from("mf_transactions")
      .select(
        "*, scheme:mf_schemes(amfi_code, name, amc, category, plan, option_type, option_label, nav, nav_date, previous_nav, is_active)",
      )
      .eq("member_id", memberId)
      .order("trade_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to),
  )
}

/** Every fund entry of the given members, for family totals and scheduled jobs. */
export async function fetchFundTransactions(
  supabase: AppSupabaseClient,
  memberIds: readonly string[],
) {
  if (memberIds.length === 0) return []
  return readAllRows("mutual fund entries", (from, to) =>
    supabase
      .from("mf_transactions")
      .select(
        "id, type, units, nav, charges, trade_date, created_at, broker_account_id, amfi_code, member_id, scheme:mf_schemes(amfi_code, name, amc, category, plan, option_type, option_label, nav, nav_date, previous_nav, is_active)",
      )
      .in("member_id", memberIds)
      .order("id")
      .range(from, to),
  )
}

/** Open funds matching every typed word, or a scheme code. Current funds first. */
export async function searchFunds(rawQuery: string): Promise<FundOption[]> {
  await requireOwner()

  const code = parseSchemeCode(rawQuery)
  const words = fundSearchWords(rawQuery)
  if (code === null && words.join("").length < 3) return []

  const supabase = await createClient()
  let request = supabase
    .from("mf_schemes")
    .select(
      "amfi_code, name, amc, plan, option_type, option_label, nav, nav_date",
    )
    .eq("is_active", true)
  if (code !== null) {
    request = request.eq("amfi_code", code)
  } else {
    for (const word of words) request = request.ilike("name", `%${word}%`)
  }

  const { data, error } = await request.order("name").limit(CANDIDATE_LIMIT)
  if (error) throw new Error(`Couldn't search funds: ${error.message}`)
  return rankFunds(data, words, todayInIndia(), RESULT_LIMIT)
}

export type FundListStatus = {
  count: number
  lastUpdated: string | null
  latestNavDate: string | null
}

/** How many funds are listed, when the list was downloaded and the newest NAV date. */
export async function getFundListStatus(): Promise<FundListStatus> {
  await requireOwner()

  const supabase = await createClient()
  const [countResult, updatedResult, navResult] = await Promise.all([
    supabase
      .from("mf_schemes")
      .select("amfi_code", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("mf_schemes")
      .select("last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("mf_schemes")
      .select("nav_date")
      .not("nav_date", "is", null)
      .order("nav_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const error = countResult.error ?? updatedResult.error ?? navResult.error
  if (error) {
    throw new Error(`Couldn't load the fund list status: ${error.message}`)
  }
  return {
    count: countResult.count ?? 0,
    lastUpdated: updatedResult.data?.last_seen_at ?? null,
    latestNavDate: navResult.data?.nav_date ?? null,
  }
}
