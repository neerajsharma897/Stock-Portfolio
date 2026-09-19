"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import {
  actionError,
  type FormState,
  validationError,
} from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import { NEWS_STALE_MINUTES, refreshNews } from "@/lib/news/refresh"
import { isBlank } from "@/lib/transactions/schema"
import { createClient } from "@/lib/supabase/server"

/** Searches Google News for stocks not checked in the last 30 minutes (one stock, or all). */
export async function refreshNewsAction(
  instrumentId: number | null,
): Promise<FormState> {
  await requireOwner()

  try {
    const summary = await refreshNews(await createClient(), {
      maxAgeMinutes: NEWS_STALE_MINUTES,
      instrumentIds: instrumentId === null ? undefined : [instrumentId],
    })
    if (summary.searched > 0) refresh()
    if (summary.searched > 0 && summary.failed === summary.searched) {
      return actionError(
        `Couldn't reach Google News. ${summary.firstError ?? ""}`.trim(),
      )
    }
    return {
      status: "success",
      message: `Checked ${summary.searched} ${summary.searched === 1 ? "stock" : "stocks"}: ${summary.articles} headlines.`,
    }
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "Couldn't check for news.",
    )
  }
}

const searchNameSchema = z.object({
  instrumentId: z.coerce.number().int().positive(),
  searchName: z.preprocess(
    (value) => (isBlank(value) ? null : value),
    z
      .string()
      .trim()
      .min(2, "Use at least 2 characters")
      .max(60, "Keep it under 60 characters")
      .regex(/^[^"]*$/, "Leave out quotation marks")
      .nullable(),
  ),
})

/** Sets the name searched on Google News for a stock; blank goes back to the symbol. */
export async function saveNewsSearchName(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()

  const parsed = searchNameSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const { instrumentId, searchName } = parsed.data

  const supabase = await createClient()
  const { data: instrument } = await supabase
    .from("instruments")
    .select("symbol")
    .eq("id", instrumentId)
    .maybeSingle()
  if (!instrument) return actionError("That stock no longer exists.")

  // Clearing checked_at makes the News page search again with the new name.
  const { error } = await supabase.from("news_feeds").upsert(
    {
      instrument_id: instrumentId,
      search_name: searchName,
      checked_at: null,
      error: null,
    },
    { onConflict: "instrument_id" },
  )
  if (error) return actionError(`Couldn't save: ${error.message}`)

  // Headlines found with the old name may not mention the new one.
  const { error: unlinkError } = await supabase
    .from("news_article_stocks")
    .delete()
    .eq("instrument_id", instrumentId)
  if (unlinkError) {
    return actionError(`Couldn't clear old headlines: ${unlinkError.message}`)
  }

  refresh()
  return {
    status: "success",
    message: searchName
      ? `News for ${instrument.symbol} now searches for "${searchName}".`
      : `News for ${instrument.symbol} searches for its symbol again.`,
  }
}
