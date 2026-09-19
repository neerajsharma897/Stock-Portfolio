"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import {
  actionError,
  type FormState,
  validationError,
} from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  MAX_WATCHLIST_STOCKS,
  MAX_WATCHLISTS,
  watchlistItemSchema,
  watchlistSchema,
} from "@/lib/watchlist/schema"

const UNIQUE_VIOLATION = "23505"

/** Like FormState, with the list's id on success so the page can open it. */
export type WatchlistFormState =
  FormState | { status: "success"; message: string; watchlistId: string }

function parseId(value: unknown) {
  const result = z.uuid().safeParse(value)
  return result.success ? result.data : null
}

function duplicateName(name: string): FormState {
  return {
    status: "error",
    fieldErrors: { name: [`There's already a watchlist called ${name}.`] },
  }
}

/** Creates a watchlist, or renames one when an id is sent. */
export async function saveWatchlist(
  _prevState: WatchlistFormState,
  formData: FormData,
): Promise<WatchlistFormState> {
  await requireOwner()

  const rawId = formData.get("id")
  const id = rawId === null ? null : parseId(rawId)
  if (rawId !== null && !id) {
    return actionError("This watchlist no longer exists.")
  }

  const parsed = watchlistSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const { name } = parsed.data

  const supabase = await createClient()

  if (id) {
    const { data, error } = await supabase
      .from("watchlists")
      .update({ name })
      .eq("id", id)
      .select("id")
    if (error) {
      if (error.code === UNIQUE_VIOLATION) return duplicateName(name)
      return actionError(`Couldn't rename: ${error.message}`)
    }
    if (data.length === 0) {
      return actionError("This watchlist no longer exists.")
    }
    refresh()
    return {
      status: "success",
      message: `Renamed the watchlist to ${name}.`,
      watchlistId: id,
    }
  }

  const { data: lists, error: listError } = await supabase
    .from("watchlists")
    .select("position")
  if (listError) {
    return actionError(`Couldn't check your watchlists: ${listError.message}`)
  }
  if (lists.length >= MAX_WATCHLISTS) {
    return actionError(
      `You can have up to ${MAX_WATCHLISTS} watchlists. Delete one to make room.`,
    )
  }

  const { data, error } = await supabase
    .from("watchlists")
    .insert({
      name,
      position: lists.reduce(
        (next, list) => Math.max(next, list.position + 1),
        0,
      ),
    })
    .select("id")
    .single()
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return duplicateName(name)
    return actionError(`Couldn't create the watchlist: ${error.message}`)
  }

  refresh()
  return {
    status: "success",
    message: `Created ${name}.`,
    watchlistId: data.id,
  }
}

/** Deletes a watchlist and its stocks (and their notes). */
export async function deleteWatchlist(watchlistId: string): Promise<FormState> {
  await requireOwner()

  const id = parseId(watchlistId)
  if (!id) return actionError("This watchlist no longer exists.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("watchlists")
    .delete()
    .eq("id", id)
    .select("name")
    .maybeSingle()
  if (error) return actionError(`Couldn't delete: ${error.message}`)
  if (!data) return actionError("This watchlist no longer exists.")

  refresh()
  return { status: "success", message: `Deleted ${data.name}.` }
}

/** Adds a stock to a watchlist, or updates its note if it's already there. */
export async function saveWatchlistItem(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()

  const parsed = watchlistItemSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const { watchlistId, instrumentId, note } = parsed.data

  const supabase = await createClient()
  const [listResult, instrumentResult, existingResult] = await Promise.all([
    supabase
      .from("watchlists")
      .select("name")
      .eq("id", watchlistId)
      .maybeSingle(),
    supabase
      .from("instruments")
      .select("symbol, kind")
      .eq("id", instrumentId)
      .maybeSingle(),
    supabase
      .from("watchlist_items")
      .select("instrument_id")
      .eq("watchlist_id", watchlistId)
      .eq("instrument_id", instrumentId)
      .maybeSingle(),
  ])
  const list = listResult.data
  const instrument = instrumentResult.data
  if (!list) return actionError("This watchlist no longer exists.")
  if (!instrument || instrument.kind === "index") {
    return {
      status: "error",
      fieldErrors: { instrumentId: ["Choose a stock from the list."] },
    }
  }

  if (!existingResult.data) {
    const { count, error: countError } = await supabase
      .from("watchlist_items")
      .select("instrument_id", { count: "exact", head: true })
      .eq("watchlist_id", watchlistId)
    if (countError) {
      return actionError(`Couldn't check the watchlist: ${countError.message}`)
    }
    if ((count ?? 0) >= MAX_WATCHLIST_STOCKS) {
      return actionError(
        `${list.name} already has ${MAX_WATCHLIST_STOCKS} stocks, the most a list can hold. Start another list.`,
      )
    }
  }

  const { error } = await supabase
    .from("watchlist_items")
    .upsert(
      { watchlist_id: watchlistId, instrument_id: instrumentId, note },
      { onConflict: "watchlist_id,instrument_id" },
    )
  if (error) return actionError(`Couldn't save: ${error.message}`)

  refresh()
  return {
    status: "success",
    message: existingResult.data
      ? `Saved the note for ${instrument.symbol}.`
      : `Added ${instrument.symbol} to ${list.name}.`,
  }
}

export async function removeWatchlistItem(
  watchlistId: string,
  instrumentId: number,
): Promise<FormState> {
  await requireOwner()

  const id = parseId(watchlistId)
  if (!id || !Number.isInteger(instrumentId) || instrumentId <= 0) {
    return actionError("That stock is no longer on this watchlist.")
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("watchlist_id", id)
    .eq("instrument_id", instrumentId)
    .select("instrument_id")
  if (error) return actionError(`Couldn't remove: ${error.message}`)
  if (data.length === 0) {
    return actionError("That stock is no longer on this watchlist.")
  }

  refresh()
  return { status: "success", message: "Removed from the watchlist." }
}
