"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import {
  actionError,
  type FormState,
  validationError,
} from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import {
  corporateActionSchema,
  describeCorporateAction,
} from "@/lib/corporate-actions/schema"
import { fetchCorporateActions } from "@/lib/data/corporate-actions"
import { toHoldingTransaction } from "@/lib/data/transactions"
import type { CorporateAction } from "@/lib/portfolio/holdings"
import { groupHoldings } from "@/lib/portfolio/member-holdings"
import { readAllRows } from "@/lib/supabase/read-all"
import { createClient } from "@/lib/supabase/server"

const UNIQUE_VIOLATION = "23505"

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Rebuilds every family holding of the stock with the changed list of splits
 * and bonuses. Returns a problem when a sell would then exceed the shares held.
 */
async function findBrokenHolding(
  supabase: Supabase,
  instrumentId: number,
  change: (actions: CorporateAction[]) => CorporateAction[],
): Promise<string | null> {
  const [transactions, actions] = await Promise.all([
    readAllRows("transactions", (from, to) =>
      supabase
        .from("transactions")
        .select(
          "id, type, quantity, price, charges, trade_date, created_at, broker_account_id, instrument_id",
        )
        .eq("instrument_id", instrumentId)
        .order("id")
        .range(from, to),
    ),
    fetchCorporateActions(supabase, [instrumentId]),
  ])
  const { problems } = groupHoldings(
    transactions.map(toHoldingTransaction),
    new Map([[instrumentId, change(actions.get(instrumentId) ?? [])]]),
  )
  return problems[0]?.message ?? null
}

export async function saveCorporateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()

  const parsed = corporateActionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const input = parsed.data

  const supabase = await createClient()
  const { data: instrument } = await supabase
    .from("instruments")
    .select("symbol, kind")
    .eq("id", input.instrumentId)
    .maybeSingle()
  if (!instrument || instrument.kind === "index") {
    return {
      status: "error",
      fieldErrors: { instrumentId: ["Choose a stock from the list."] },
    }
  }

  try {
    const problem = await findBrokenHolding(
      supabase,
      input.instrumentId,
      (actions) => [...actions, { id: "new", ...input }],
    )
    if (problem) {
      return actionError(
        `This would leave a sell larger than the shares held. ${problem}`,
      )
    }
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "Couldn't check holdings.",
    )
  }

  const { error } = await supabase.from("corporate_actions").insert({
    instrument_id: input.instrumentId,
    kind: input.kind,
    ex_date: input.exDate,
    ratio_from: input.ratioFrom,
    ratio_to: input.ratioTo,
    notes: input.notes,
  })
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return actionError(
        `${instrument.symbol} already has a ${input.kind} on that date.`,
      )
    }
    return actionError(`Couldn't save: ${error.message}`)
  }

  refresh()
  return {
    status: "success",
    message: `Saved ${describeCorporateAction(input).toLowerCase()} for ${instrument.symbol}. Holdings are recalculated.`,
  }
}

export async function deleteCorporateAction(
  actionId: string,
): Promise<FormState> {
  await requireOwner()

  const parsedId = z.uuid().safeParse(actionId)
  if (!parsedId.success) return actionError("This entry no longer exists.")
  const id = parsedId.data

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from("corporate_actions")
    .select("instrument_id, instrument:instruments(symbol)")
    .eq("id", id)
    .maybeSingle()
  if (error) return actionError(`Couldn't load this entry: ${error.message}`)
  if (!row) return actionError("This entry no longer exists.")

  try {
    const problem = await findBrokenHolding(
      supabase,
      row.instrument_id,
      (actions) => actions.filter((action) => action.id !== id),
    )
    if (problem) {
      return actionError(
        `Can't delete: a later sell needs these shares. Change that sell first. (${problem})`,
      )
    }
  } catch (checkError) {
    return actionError(
      checkError instanceof Error
        ? checkError.message
        : "Couldn't check holdings.",
    )
  }

  const { error: deleteError } = await supabase
    .from("corporate_actions")
    .delete()
    .eq("id", id)
  if (deleteError) return actionError(`Couldn't delete: ${deleteError.message}`)

  refresh()
  return {
    status: "success",
    message: `Deleted the entry for ${row.instrument.symbol}. Holdings are recalculated.`,
  }
}
