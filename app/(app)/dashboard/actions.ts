"use server"

import { refresh } from "next/cache"

import { actionError, type FormState } from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import { parsePriceInput } from "@/lib/prices/parse"
import { createClient } from "@/lib/supabase/server"

const FOREIGN_KEY_VIOLATION = "23503"

/**
 * Saves hand-entered prices from the "Update prices" form. Fields per stock:
 * instrumentId, lastPrice-<id>, previousClose-<id>. A blank last price keeps the saved one.
 */
export async function savePrices(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()

  const instrumentIds = [
    ...new Set(
      formData
        .getAll("instrumentId")
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ]
  if (instrumentIds.length === 0) {
    return actionError("There are no stocks to price.")
  }

  const pricedAt = new Date().toISOString()
  const fieldErrors: Record<string, string[]> = {}
  const rows = []

  for (const id of instrumentIds) {
    const lastField = `lastPrice-${id}`
    const previousField = `previousClose-${id}`
    const last = parsePriceInput(formData.get(lastField))
    const previous = parsePriceInput(formData.get(previousField))

    if (!last.ok) fieldErrors[lastField] = [last.message]
    if (!previous.ok) fieldErrors[previousField] = [previous.message]
    if (!last.ok || !previous.ok) continue

    if (last.value === null) {
      if (previous.value !== null) {
        fieldErrors[lastField] = ["Enter the last price too"]
      }
      continue
    }

    rows.push({
      instrument_id: id,
      last_price: last.value,
      previous_close: previous.value,
      source: "manual" as const,
      priced_at: pricedAt,
    })
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Fix the highlighted prices.",
      fieldErrors,
    }
  }
  if (rows.length === 0) return actionError("Enter at least one last price.")

  const supabase = await createClient()
  const { error } = await supabase
    .from("instrument_prices")
    .upsert(rows, { onConflict: "instrument_id" })

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return actionError(
        "One of these stocks no longer exists. Reload the page.",
      )
    }
    return actionError(`Couldn't save prices: ${error.message}`)
  }

  refresh()
  return {
    status: "success",
    message: `Saved ${rows.length} ${rows.length === 1 ? "price" : "prices"}.`,
  }
}
