"use server"

import { refresh } from "next/cache"

import { actionError, type FormState } from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import { formatQuantity } from "@/lib/format"
import { importInstruments } from "@/lib/instruments/import"

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
