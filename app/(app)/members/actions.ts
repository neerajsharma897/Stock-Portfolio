"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import {
  actionError,
  type FormState,
  validationError,
} from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import { BROKER_LABELS } from "@/lib/members/options"
import { brokerAccountSchema, memberSchema } from "@/lib/members/schema"
import { createClient } from "@/lib/supabase/server"

const UNIQUE_VIOLATION = "23505"
const FOREIGN_KEY_VIOLATION = "23503"

/** Returns the id when valid; `undefined` when the field is absent (creating a new row). */
function parseOptionalId(value: FormDataEntryValue | null) {
  if (value === null) return undefined
  const result = z.uuid().safeParse(value)
  return result.success ? result.data : null
}

function parseId(value: unknown) {
  const result = z.uuid().safeParse(value)
  return result.success ? result.data : null
}

// Members ----------------------------------------------------------------------

export async function saveMember(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()

  const id = parseOptionalId(formData.get("id"))
  if (id === null) return actionError("This member no longer exists.")

  const parsed = memberSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)

  const { name, relation, color, panLast4, notes } = parsed.data
  const row = { name, relation, color, pan_last4: panLast4, notes }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase.from("members").update(row).eq("id", id).select("id")
    : await supabase.from("members").insert(row).select("id")

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        status: "error",
        fieldErrors: error.message.includes("members_one_self_key")
          ? { relation: ["Another member is already set as Self."] }
          : { name: ["Another member already has this name."] },
      }
    }
    return actionError(`Couldn't save: ${error.message}`)
  }
  if (data.length === 0) return actionError("This member no longer exists.")

  refresh()
  return {
    status: "success",
    message: id ? `Saved ${name}.` : `Added ${name}.`,
  }
}

export async function setMemberArchived(
  memberId: string,
  archived: boolean,
): Promise<FormState> {
  await requireOwner()

  const id = parseId(memberId)
  if (!id) return actionError("This member no longer exists.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("members")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("name")
    .maybeSingle()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return actionError(
        "An active member already has this name or is set as Self. Change that member first, then restore.",
      )
    }
    return actionError(`Couldn't update: ${error.message}`)
  }
  if (!data) return actionError("This member no longer exists.")

  refresh()
  return {
    status: "success",
    message: archived ? `Archived ${data.name}.` : `Restored ${data.name}.`,
  }
}

/** Permanently deletes an archived member and their accounts. Active members must be archived first. */
export async function deleteMember(memberId: string): Promise<FormState> {
  await requireOwner()

  const id = parseId(memberId)
  if (!id) return actionError("This member no longer exists.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("members")
    .delete()
    .eq("id", id)
    .not("archived_at", "is", null)
    .select("name")
    .maybeSingle()

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return actionError(
        "This member has transactions, so they can't be deleted. Delete the transactions first, or keep the member archived.",
      )
    }
    return actionError(`Couldn't delete: ${error.message}`)
  }
  if (!data) {
    return actionError("Only archived members can be deleted. Archive first.")
  }

  // No refresh(): the client navigates back to the members list.
  return { status: "success", message: `Deleted ${data.name}.` }
}

// Broker accounts ----------------------------------------------------------------

export async function saveBrokerAccount(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()

  const memberId = parseId(formData.get("memberId"))
  if (!memberId) return actionError("This member no longer exists.")
  const id = parseOptionalId(formData.get("id"))
  if (id === null) return actionError("This account no longer exists.")

  const parsed = brokerAccountSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)

  const { broker, label, clientIdLast4, notes } = parsed.data
  const row = { broker, label, client_id_last4: clientIdLast4, notes }

  const supabase = await createClient()
  const { data, error } = id
    ? await supabase
        .from("broker_accounts")
        .update(row)
        .eq("id", id)
        .eq("member_id", memberId)
        .select("id")
    : await supabase
        .from("broker_accounts")
        .insert({ ...row, member_id: memberId })
        .select("id")

  const brokerName = BROKER_LABELS[broker]
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        status: "error",
        fieldErrors: {
          label: [
            label
              ? `There's already a ${brokerName} account with this label.`
              : `There's already a ${brokerName} account. Add a label to tell them apart, e.g. "Joint".`,
          ],
        },
      }
    }
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return actionError("This member no longer exists.")
    }
    return actionError(`Couldn't save: ${error.message}`)
  }
  if (data.length === 0) return actionError("This account no longer exists.")

  refresh()
  return {
    status: "success",
    message: id
      ? `Saved ${brokerName} account.`
      : `Added ${brokerName} account.`,
  }
}

export async function deleteBrokerAccount(
  accountId: string,
): Promise<FormState> {
  await requireOwner()

  const id = parseId(accountId)
  if (!id) return actionError("This account no longer exists.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("broker_accounts")
    .delete()
    .eq("id", id)
    .select("broker")
    .maybeSingle()

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return actionError(
        "This account has transactions, so it can't be deleted. Delete those transactions or move them to another account first.",
      )
    }
    return actionError(`Couldn't delete: ${error.message}`)
  }
  if (!data) return actionError("This account no longer exists.")

  refresh()
  return {
    status: "success",
    message: `Deleted ${BROKER_LABELS[data.broker]} account.`,
  }
}
