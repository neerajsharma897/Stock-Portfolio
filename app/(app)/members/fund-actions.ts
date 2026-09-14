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
  searchFunds,
  toFundHoldingTransaction,
  type FundOption,
} from "@/lib/data/mutual-funds"
import {
  MF_TRANSACTION_LABELS,
  toHoldingType,
} from "@/lib/mutual-funds/options"
import { mfTransactionSchema } from "@/lib/mutual-funds/schema"
import { buildPosition } from "@/lib/portfolio/holdings"
import { createClient } from "@/lib/supabase/server"

const FOREIGN_KEY_VIOLATION = "23503"
const POSITION_COLUMNS =
  "id, type, units, nav, charges, trade_date, created_at, broker_account_id, amfi_code"
const LABELS = { sellLabel: "redemption" }

type Supabase = Awaited<ReturnType<typeof createClient>>

function parseId(value: unknown) {
  const result = z.uuid().safeParse(value)
  return result.success ? result.data : null
}

function fieldError(field: string, message: string): FormState {
  return { status: "error", fieldErrors: { [field]: [message] } }
}

/** Every entry of one holding: an account's units in one fund. */
async function loadPosition(
  supabase: Supabase,
  brokerAccountId: string,
  amfiCode: number,
) {
  const { data, error } = await supabase
    .from("mf_transactions")
    .select(POSITION_COLUMNS)
    .eq("broker_account_id", brokerAccountId)
    .eq("amfi_code", amfiCode)
  if (error) {
    throw new Error(`Couldn't check existing entries: ${error.message}`)
  }
  return data.map(toFundHoldingTransaction)
}

export async function searchFundsAction(query: string): Promise<FundOption[]> {
  return searchFunds(query)
}

export async function saveFundTransaction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()

  const memberId = parseId(formData.get("memberId"))
  if (!memberId) return actionError("This member no longer exists.")
  const rawId = formData.get("id")
  const id = rawId === null ? null : parseId(rawId)
  if (rawId !== null && !id) return actionError("This entry no longer exists.")

  const parsed = mfTransactionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const input = parsed.data

  const supabase = await createClient()

  const { data: account } = await supabase
    .from("broker_accounts")
    .select("broker")
    .eq("id", input.brokerAccountId)
    .eq("member_id", memberId)
    .maybeSingle()
  if (!account) {
    return fieldError(
      "brokerAccountId",
      "Choose one of this member's accounts.",
    )
  }
  if (account.broker === "coindcx") {
    return fieldError(
      "brokerAccountId",
      "CoinDCX is a crypto exchange. Choose where the fund is held.",
    )
  }

  const { data: scheme } = await supabase
    .from("mf_schemes")
    .select("name")
    .eq("amfi_code", input.amfiCode)
    .maybeSingle()
  if (!scheme) return fieldError("amfiCode", "Choose a fund from the list.")

  let original: ReturnType<typeof toFundHoldingTransaction> | null = null
  if (id) {
    const { data, error } = await supabase
      .from("mf_transactions")
      .select(POSITION_COLUMNS)
      .eq("id", id)
      .eq("member_id", memberId)
      .maybeSingle()
    if (error) return actionError(`Couldn't load this entry: ${error.message}`)
    if (!data) return actionError("This entry no longer exists.")
    original = toFundHoldingTransaction(data)
  }

  // Refuse changes that would redeem more units than held at any date.
  const candidate = {
    id: id ?? "new",
    type: toHoldingType(input.type),
    quantity: input.units,
    price: input.nav,
    charges: input.charges,
    tradeDate: input.tradeDate,
    createdAt: original?.createdAt ?? new Date().toISOString(),
  }
  try {
    const position = await loadPosition(
      supabase,
      input.brokerAccountId,
      input.amfiCode,
    )
    const check = buildPosition(
      [...position.filter((entry) => entry.id !== id), candidate],
      LABELS,
    )
    if (!check.ok) {
      return actionError(
        check.transactionId === candidate.id
          ? check.message
          : `This change would break a later redemption. ${check.message}`,
      )
    }

    const moved =
      original &&
      (original.brokerAccountId !== input.brokerAccountId ||
        original.amfiCode !== input.amfiCode)
    if (original && moved) {
      const previous = await loadPosition(
        supabase,
        original.brokerAccountId,
        original.amfiCode,
      )
      const previousCheck = buildPosition(
        previous.filter((entry) => entry.id !== id),
        LABELS,
      )
      if (!previousCheck.ok) {
        return actionError(
          `Moving this entry would break a redemption it currently covers. ${previousCheck.message}`,
        )
      }
    }
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "Couldn't check this entry.",
    )
  }

  const row = {
    broker_account_id: input.brokerAccountId,
    amfi_code: input.amfiCode,
    folio_number: input.folioNumber,
    type: input.type,
    units: input.units,
    nav: input.nav,
    charges: input.charges,
    trade_date: input.tradeDate,
    notes: input.notes,
  }
  const { data, error } = id
    ? await supabase
        .from("mf_transactions")
        .update(row)
        .eq("id", id)
        .eq("member_id", memberId)
        .select("id")
    : await supabase
        .from("mf_transactions")
        .insert({ ...row, member_id: memberId })
        .select("id")

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return actionError("That account or fund no longer exists.")
    }
    return actionError(`Couldn't save: ${error.message}`)
  }
  if (data.length === 0) return actionError("This entry no longer exists.")

  refresh()
  const label = MF_TRANSACTION_LABELS[input.type].toLowerCase()
  return {
    status: "success",
    message: id
      ? `Saved ${label} of ${scheme.name}.`
      : `Added ${label} of ${scheme.name}.`,
  }
}

export async function deleteFundTransaction(
  transactionId: string,
): Promise<FormState> {
  await requireOwner()

  const id = parseId(transactionId)
  if (!id) return actionError("This entry no longer exists.")

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from("mf_transactions")
    .select("broker_account_id, amfi_code, type, scheme:mf_schemes(name)")
    .eq("id", id)
    .maybeSingle()
  if (error) return actionError(`Couldn't load this entry: ${error.message}`)
  if (!row) return actionError("This entry no longer exists.")

  try {
    const remaining = await loadPosition(
      supabase,
      row.broker_account_id,
      row.amfi_code,
    )
    const check = buildPosition(
      remaining.filter((entry) => entry.id !== id),
      LABELS,
    )
    if (!check.ok) {
      return actionError(
        `Can't delete: a later redemption needs these units. Change or delete that redemption first. (${check.message})`,
      )
    }
  } catch (checkError) {
    return actionError(
      checkError instanceof Error
        ? checkError.message
        : "Couldn't check this entry.",
    )
  }

  const { error: deleteError } = await supabase
    .from("mf_transactions")
    .delete()
    .eq("id", id)
  if (deleteError) {
    return actionError(`Couldn't delete: ${deleteError.message}`)
  }

  refresh()
  return {
    status: "success",
    message: `Deleted ${MF_TRANSACTION_LABELS[row.type].toLowerCase()} of ${row.scheme.name}.`,
  }
}
