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
  type InstrumentOption,
  searchInstruments,
} from "@/lib/data/instruments"
import { toHoldingTransaction } from "@/lib/data/transactions"
import { buildPosition } from "@/lib/portfolio/holdings"
import { createClient } from "@/lib/supabase/server"
import { TRANSACTION_TYPE_LABELS } from "@/lib/transactions/options"
import { transactionSchema } from "@/lib/transactions/schema"

const FOREIGN_KEY_VIOLATION = "23503"
const POSITION_COLUMNS =
  "id, type, quantity, price, charges, trade_date, created_at, broker_account_id, instrument_id"

type Supabase = Awaited<ReturnType<typeof createClient>>

function parseId(value: unknown) {
  const result = z.uuid().safeParse(value)
  return result.success ? result.data : null
}

function fieldError(field: string, message: string): FormState {
  return { status: "error", fieldErrors: { [field]: [message] } }
}

/** Every transaction of one position: a broker account's holding of one stock. */
async function loadPosition(
  supabase: Supabase,
  brokerAccountId: string,
  instrumentId: number,
) {
  const { data, error } = await supabase
    .from("transactions")
    .select(POSITION_COLUMNS)
    .eq("broker_account_id", brokerAccountId)
    .eq("instrument_id", instrumentId)
  if (error) {
    throw new Error(`Couldn't check existing transactions: ${error.message}`)
  }
  return data.map(toHoldingTransaction)
}

export async function searchInstrumentsAction(
  query: string,
): Promise<InstrumentOption[]> {
  return searchInstruments(query)
}

export async function saveTransaction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()

  const memberId = parseId(formData.get("memberId"))
  if (!memberId) return actionError("This member no longer exists.")
  const rawId = formData.get("id")
  const id = rawId === null ? null : parseId(rawId)
  if (rawId !== null && !id) {
    return actionError("This transaction no longer exists.")
  }

  const parsed = transactionSchema.safeParse(Object.fromEntries(formData))
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
      "CoinDCX is a crypto exchange. Choose a stock broker account.",
    )
  }

  const { data: instrument } = await supabase
    .from("instruments")
    .select("symbol, kind")
    .eq("id", input.instrumentId)
    .maybeSingle()
  if (!instrument || instrument.kind === "index") {
    return fieldError("instrumentId", "Choose a stock from the list.")
  }

  let original: ReturnType<typeof toHoldingTransaction> | null = null
  if (id) {
    const { data, error } = await supabase
      .from("transactions")
      .select(POSITION_COLUMNS)
      .eq("id", id)
      .eq("member_id", memberId)
      .maybeSingle()
    if (error)
      return actionError(`Couldn't load this transaction: ${error.message}`)
    if (!data) return actionError("This transaction no longer exists.")
    original = toHoldingTransaction(data)
  }

  // Refuse changes that would leave any sell larger than the shares held at that date.
  const candidate = {
    id: id ?? "new",
    type: input.type,
    quantity: input.quantity,
    price: input.price,
    charges: input.charges,
    tradeDate: input.tradeDate,
    createdAt: original?.createdAt ?? new Date().toISOString(),
  }
  try {
    const position = await loadPosition(
      supabase,
      input.brokerAccountId,
      input.instrumentId,
    )
    const check = buildPosition([
      ...position.filter((transaction) => transaction.id !== id),
      candidate,
    ])
    if (!check.ok) {
      return actionError(
        check.transactionId === candidate.id
          ? check.message
          : `This change would break a later sell. ${check.message}`,
      )
    }

    const moved =
      original &&
      (original.brokerAccountId !== input.brokerAccountId ||
        original.instrumentId !== input.instrumentId)
    if (original && moved) {
      const previous = await loadPosition(
        supabase,
        original.brokerAccountId,
        original.instrumentId,
      )
      const previousCheck = buildPosition(
        previous.filter((transaction) => transaction.id !== id),
      )
      if (!previousCheck.ok) {
        return actionError(
          `Moving this entry would break a sell it currently covers. ${previousCheck.message}`,
        )
      }
    }
  } catch (error) {
    return actionError(
      error instanceof Error
        ? error.message
        : "Couldn't check this transaction.",
    )
  }

  const row = {
    broker_account_id: input.brokerAccountId,
    instrument_id: input.instrumentId,
    type: input.type,
    quantity: input.quantity,
    price: input.price,
    charges: input.charges,
    trade_date: input.tradeDate,
    notes: input.notes,
  }
  const { data, error } = id
    ? await supabase
        .from("transactions")
        .update(row)
        .eq("id", id)
        .eq("member_id", memberId)
        .select("id")
    : await supabase
        .from("transactions")
        .insert({ ...row, member_id: memberId })
        .select("id")

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return actionError("That account or stock no longer exists.")
    }
    return actionError(`Couldn't save: ${error.message}`)
  }
  if (data.length === 0)
    return actionError("This transaction no longer exists.")

  refresh()
  const label = TRANSACTION_TYPE_LABELS[input.type].toLowerCase()
  return {
    status: "success",
    message: id
      ? `Saved ${label} of ${instrument.symbol}.`
      : `Added ${label} of ${instrument.symbol}.`,
  }
}

export async function deleteTransaction(
  transactionId: string,
): Promise<FormState> {
  await requireOwner()

  const id = parseId(transactionId)
  if (!id) return actionError("This transaction no longer exists.")

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from("transactions")
    .select(
      "broker_account_id, instrument_id, type, instrument:instruments(symbol)",
    )
    .eq("id", id)
    .maybeSingle()
  if (error)
    return actionError(`Couldn't load this transaction: ${error.message}`)
  if (!row) return actionError("This transaction no longer exists.")

  try {
    const remaining = await loadPosition(
      supabase,
      row.broker_account_id,
      row.instrument_id,
    )
    const check = buildPosition(
      remaining.filter((transaction) => transaction.id !== id),
    )
    if (!check.ok) {
      return actionError(
        `Can't delete: a later sell needs these shares. Change or delete that sell first. (${check.message})`,
      )
    }
  } catch (checkError) {
    return actionError(
      checkError instanceof Error
        ? checkError.message
        : "Couldn't check this transaction.",
    )
  }

  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
  if (deleteError) {
    return actionError(`Couldn't delete: ${deleteError.message}`)
  }

  refresh()
  return {
    status: "success",
    message: `Deleted ${TRANSACTION_TYPE_LABELS[row.type].toLowerCase()} of ${row.instrument.symbol}.`,
  }
}
