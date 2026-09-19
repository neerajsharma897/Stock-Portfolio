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
  depositSchema,
  ipoSchema,
  otherAssetSchema,
} from "@/lib/other-assets/schema"
import { createClient } from "@/lib/supabase/server"

const FOREIGN_KEY_VIOLATION = "23503"

function parseId(value: unknown) {
  const result = z.uuid().safeParse(value)
  return result.success ? result.data : null
}

/** The member and, when editing, the entry being changed. */
function readIds(formData: FormData) {
  const memberId = parseId(formData.get("memberId"))
  const rawId = formData.get("id")
  const id = rawId === null ? null : parseId(rawId)
  return { memberId, id, badId: rawId !== null && !id }
}

type Saved = {
  data: { id: string }[] | null
  error: { code: string; message: string } | null
}

function savedResult(result: Saved, message: string): FormState {
  if (result.error) {
    if (result.error.code === FOREIGN_KEY_VIOLATION) {
      return actionError("This member no longer exists.")
    }
    return actionError(`Couldn't save: ${result.error.message}`)
  }
  if (!result.data || result.data.length === 0) {
    return actionError("This entry no longer exists.")
  }
  refresh()
  return { status: "success", message }
}

// Fixed deposits -----------------------------------------------------------------

export async function saveDeposit(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()
  const { memberId, id, badId } = readIds(formData)
  if (!memberId) return actionError("This member no longer exists.")
  if (badId) return actionError("This entry no longer exists.")

  const parsed = depositSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const input = parsed.data

  const row = {
    bank: input.bank,
    principal: input.principal,
    rate_pct: input.ratePct,
    interest: input.interest,
    start_date: input.startDate,
    maturity_date: input.maturityDate,
    closed_on: input.closedOn,
    notes: input.notes,
  }
  const supabase = await createClient()
  const result = id
    ? await supabase
        .from("fixed_deposits")
        .update(row)
        .eq("id", id)
        .eq("member_id", memberId)
        .select("id")
    : await supabase
        .from("fixed_deposits")
        .insert({ ...row, member_id: memberId })
        .select("id")
  return savedResult(
    result,
    id ? `Saved the ${input.bank} FD.` : `Added the ${input.bank} FD.`,
  )
}

export async function deleteDeposit(depositId: string): Promise<FormState> {
  await requireOwner()
  const id = parseId(depositId)
  if (!id) return actionError("This entry no longer exists.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("fixed_deposits")
    .delete()
    .eq("id", id)
    .select("bank")
    .maybeSingle()
  if (error) return actionError(`Couldn't delete: ${error.message}`)
  if (!data) return actionError("This entry no longer exists.")

  refresh()
  return { status: "success", message: `Deleted the ${data.bank} FD.` }
}

// Other assets -------------------------------------------------------------------

export async function saveOtherAsset(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()
  const { memberId, id, badId } = readIds(formData)
  if (!memberId) return actionError("This member no longer exists.")
  if (badId) return actionError("This entry no longer exists.")

  const parsed = otherAssetSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const input = parsed.data

  const row = {
    kind: input.kind,
    name: input.name,
    invested: input.invested,
    current_value: input.currentValue,
    value_as_of: input.valueAsOf,
    notes: input.notes,
  }
  const supabase = await createClient()
  const result = id
    ? await supabase
        .from("other_assets")
        .update(row)
        .eq("id", id)
        .eq("member_id", memberId)
        .select("id")
    : await supabase
        .from("other_assets")
        .insert({ ...row, member_id: memberId })
        .select("id")
  return savedResult(
    result,
    id ? `Saved ${input.name}.` : `Added ${input.name}.`,
  )
}

export async function deleteOtherAsset(assetId: string): Promise<FormState> {
  await requireOwner()
  const id = parseId(assetId)
  if (!id) return actionError("This entry no longer exists.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("other_assets")
    .delete()
    .eq("id", id)
    .select("name")
    .maybeSingle()
  if (error) return actionError(`Couldn't delete: ${error.message}`)
  if (!data) return actionError("This entry no longer exists.")

  refresh()
  return { status: "success", message: `Deleted ${data.name}.` }
}

// IPO applications ---------------------------------------------------------------

export async function saveIpo(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()
  const { memberId, id, badId } = readIds(formData)
  if (!memberId) return actionError("This member no longer exists.")
  if (badId) return actionError("This entry no longer exists.")

  const parsed = ipoSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const input = parsed.data

  const row = {
    company: input.company,
    applied_on: input.appliedOn,
    shares_applied: input.sharesApplied,
    price: input.price,
    status: input.status,
    shares_allotted: input.status === "allotted" ? input.sharesAllotted : null,
    notes: input.notes,
  }
  const supabase = await createClient()
  const result = id
    ? await supabase
        .from("ipo_applications")
        .update(row)
        .eq("id", id)
        .eq("member_id", memberId)
        .select("id")
    : await supabase
        .from("ipo_applications")
        .insert({ ...row, member_id: memberId })
        .select("id")
  return savedResult(
    result,
    id
      ? `Saved the ${input.company} IPO application.`
      : `Added the ${input.company} IPO application.`,
  )
}

export async function deleteIpo(ipoId: string): Promise<FormState> {
  await requireOwner()
  const id = parseId(ipoId)
  if (!id) return actionError("This entry no longer exists.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("ipo_applications")
    .delete()
    .eq("id", id)
    .select("company")
    .maybeSingle()
  if (error) return actionError(`Couldn't delete: ${error.message}`)
  if (!data) return actionError("This entry no longer exists.")

  refresh()
  return {
    status: "success",
    message: `Deleted the ${data.company} IPO application.`,
  }
}
