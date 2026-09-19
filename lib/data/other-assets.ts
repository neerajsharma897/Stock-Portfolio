import "server-only"

import { z } from "zod"

import { requireOwner } from "@/lib/auth"
import {
  valueDeposit,
  type AssetValue,
  type ValuedDeposit,
} from "@/lib/other-assets/portfolio"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/lib/supabase/types"

export type DepositRow = Tables<"fixed_deposits">
export type OtherAssetRow = Tables<"other_assets">
export type IpoApplication = Tables<"ipo_applications">

export type Deposit = ValuedDeposit<{
  id: string
  memberId: string
  bank: string
  principal: number
  ratePct: number
  interest: DepositRow["interest"]
  startDate: string
  maturityDate: string
  closedOn: string | null
  notes: string | null
}>

export type OtherAsset = AssetValue & {
  id: string
  memberId: string
  kind: OtherAssetRow["kind"]
  name: string
  notes: string | null
}

export type OtherAssets = {
  deposits: Deposit[]
  otherAssets: OtherAsset[]
  ipos: IpoApplication[]
}

export function toDeposit(row: DepositRow, asOf: string): Deposit {
  return valueDeposit(
    {
      id: row.id,
      memberId: row.member_id,
      bank: row.bank,
      principal: Number(row.principal),
      ratePct: Number(row.rate_pct),
      interest: row.interest,
      startDate: row.start_date,
      maturityDate: row.maturity_date,
      closedOn: row.closed_on,
      notes: row.notes,
    },
    asOf,
  )
}

export function toOtherAsset(row: OtherAssetRow): OtherAsset {
  return {
    id: row.id,
    memberId: row.member_id,
    kind: row.kind,
    name: row.name,
    invested: Number(row.invested),
    currentValue: Number(row.current_value),
    valueAsOf: row.value_as_of,
    notes: row.notes,
  }
}

/** FDs, other assets and IPO applications of the given members. Any client. */
export async function fetchOtherAssets(
  supabase: AppSupabaseClient,
  memberIds: readonly string[],
  asOf: string,
): Promise<OtherAssets> {
  if (memberIds.length === 0) return { deposits: [], otherAssets: [], ipos: [] }

  const [deposits, otherAssets, ipos] = await Promise.all([
    supabase
      .from("fixed_deposits")
      .select("*")
      .in("member_id", memberIds)
      .order("maturity_date"),
    supabase
      .from("other_assets")
      .select("*")
      .in("member_id", memberIds)
      .order("name"),
    supabase
      .from("ipo_applications")
      .select("*")
      .in("member_id", memberIds)
      .order("applied_on", { ascending: false }),
  ])
  const error = deposits.error ?? otherAssets.error ?? ipos.error
  if (error) throw new Error(`Couldn't load other assets: ${error.message}`)

  return {
    deposits: (deposits.data ?? []).map((row) => toDeposit(row, asOf)),
    otherAssets: (otherAssets.data ?? []).map(toOtherAsset),
    ipos: ipos.data ?? [],
  }
}

/** One member's FDs, other assets and IPO applications. */
export async function listMemberOtherAssets(
  memberId: string,
  asOf: string,
): Promise<OtherAssets> {
  await requireOwner()
  if (!z.uuid().safeParse(memberId).success) {
    return { deposits: [], otherAssets: [], ipos: [] }
  }
  return fetchOtherAssets(await createClient(), [memberId], asOf)
}
