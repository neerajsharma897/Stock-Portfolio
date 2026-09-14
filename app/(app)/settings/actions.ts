"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import {
  actionError,
  type FormState,
  validationError,
} from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import { isValidIsoDate } from "@/lib/dates"
import { formatDate, formatQuantity } from "@/lib/format"
import { importInstruments } from "@/lib/instruments/import"
import { createClient } from "@/lib/supabase/server"

export async function updateStockList(): Promise<FormState> {
  await requireOwner()

  try {
    const { imported, deactivated } = await importInstruments()
    refresh()
    const delisted =
      deactivated > 0
        ? ` ${formatQuantity(deactivated)} no longer listed were marked inactive.`
        : ""
    return {
      status: "success",
      message: `Stock list updated: ${formatQuantity(imported)} entries.${delisted}`,
    }
  } catch (error) {
    return actionError(
      error instanceof Error
        ? error.message
        : "Couldn't update the stock list.",
    )
  }
}

const holidaySchema = z.object({
  date: z.string("Enter a date").refine(isValidIsoDate, "Enter a valid date"),
  description: z
    .string("Enter a name")
    .trim()
    .min(1, "Enter a name, e.g. Diwali Laxmi Pujan")
    .max(80, "Keep the name under 80 characters"),
})

/** Adds a market holiday, or renames it if the date is already listed. */
export async function saveMarketHoliday(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()

  const parsed = holidaySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const { date, description } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from("market_holidays")
    .upsert({ holiday_date: date, description }, { onConflict: "holiday_date" })
  if (error) return actionError(`Couldn't save the holiday: ${error.message}`)

  refresh()
  return {
    status: "success",
    message: `Saved ${formatDate(date)}: ${description}.`,
  }
}

export async function deleteMarketHoliday(date: string): Promise<FormState> {
  await requireOwner()
  if (!isValidIsoDate(date))
    return actionError("That holiday no longer exists.")

  const supabase = await createClient()
  const { error } = await supabase
    .from("market_holidays")
    .delete()
    .eq("holiday_date", date)
  if (error) {
    return actionError(`Couldn't delete the holiday: ${error.message}`)
  }

  refresh()
  return { status: "success", message: `Removed ${formatDate(date)}.` }
}
