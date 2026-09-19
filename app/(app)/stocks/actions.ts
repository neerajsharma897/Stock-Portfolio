"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import {
  actionError,
  type FormState,
  validationError,
} from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import { formatQuantity } from "@/lib/format"
import { refreshSectors } from "@/lib/sectors/refresh"
import { createClient } from "@/lib/supabase/server"

export async function updateSectors(): Promise<FormState> {
  await requireOwner()
  try {
    const saved = await refreshSectors(await createClient())
    refresh()
    return {
      status: "success",
      message: `Sectors updated for ${formatQuantity(saved)} stocks.`,
    }
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "Couldn't update sectors.",
    )
  }
}

const stockSectorSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Choose a stock.")
    .max(40)
    .transform((value) => value.toUpperCase()),
  sector: z
    .string()
    .trim()
    .min(1, "Enter a sector.")
    .max(60, "Keep it under 60 characters."),
})

/** Sets a stock's sector by hand; the weekly NSE update leaves it alone. */
export async function setStockSector(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()
  const parsed = stockSectorSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const { symbol, sector } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from("stock_sectors")
    .upsert({ symbol, sector, source: "manual" }, { onConflict: "symbol" })
  if (error) return actionError(`Couldn't save: ${error.message}`)
  refresh()
  return { status: "success", message: `${symbol} is now in ${sector}.` }
}
