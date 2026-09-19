import "server-only"

import { requireOwner } from "@/lib/auth"
import type { CorporateAction } from "@/lib/portfolio/holdings"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/lib/supabase/types"

export type CorporateActionRow = Pick<
  Tables<"corporate_actions">,
  "id" | "kind" | "ex_date" | "ratio_from" | "ratio_to" | "notes"
> & {
  instrument: Pick<Tables<"instruments">, "id" | "exchange" | "symbol">
}

export function toCorporateAction(
  row: Pick<
    Tables<"corporate_actions">,
    "id" | "kind" | "ex_date" | "ratio_from" | "ratio_to"
  >,
): CorporateAction {
  return {
    id: row.id,
    kind: row.kind,
    exDate: row.ex_date,
    ratioFrom: row.ratio_from,
    ratioTo: row.ratio_to,
  }
}

/** Splits and bonuses of the given stocks, by stock. Any client (jobs use the admin client). */
export async function fetchCorporateActions(
  supabase: AppSupabaseClient,
  instrumentIds: Iterable<number>,
): Promise<Map<number, CorporateAction[]>> {
  const ids = [...new Set(instrumentIds)]
  const actions = new Map<number, CorporateAction[]>()
  if (ids.length === 0) return actions

  const { data, error } = await supabase
    .from("corporate_actions")
    .select("id, instrument_id, kind, ex_date, ratio_from, ratio_to")
    .in("instrument_id", ids)
  if (error)
    throw new Error(`Couldn't load splits and bonuses: ${error.message}`)

  for (const row of data) {
    const list = actions.get(row.instrument_id)
    if (list) list.push(toCorporateAction(row))
    else actions.set(row.instrument_id, [toCorporateAction(row)])
  }
  return actions
}

/** Same as fetchCorporateActions, for pages (owner only). */
export async function listCorporateActionsFor(
  instrumentIds: Iterable<number>,
): Promise<Map<number, CorporateAction[]>> {
  await requireOwner()
  return fetchCorporateActions(await createClient(), instrumentIds)
}

/** Every split and bonus, latest ex-date first. */
export async function listCorporateActions(): Promise<CorporateActionRow[]> {
  await requireOwner()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("corporate_actions")
    .select(
      "id, kind, ex_date, ratio_from, ratio_to, notes, instrument:instruments(id, exchange, symbol)",
    )
    .order("ex_date", { ascending: false })
  if (error)
    throw new Error(`Couldn't load splits and bonuses: ${error.message}`)
  return data
}
