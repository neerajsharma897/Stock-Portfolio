"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import {
  actionError,
  type FormState,
  validationError,
} from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import { cryptoTransactionSchema } from "@/lib/crypto/schema"
import {
  searchCoins,
  toCryptoHoldingTransaction,
  type CoinOption,
} from "@/lib/data/crypto"
import { canHoldCrypto } from "@/lib/members/options"
import { buildPosition } from "@/lib/portfolio/holdings"
import { createClient } from "@/lib/supabase/server"
import { TRANSACTION_TYPE_LABELS } from "@/lib/transactions/options"

const FOREIGN_KEY_VIOLATION = "23503"
const POSITION_COLUMNS =
  "id, type, quantity, price, charges, trade_date, created_at, broker_account_id, market"

type Supabase = Awaited<ReturnType<typeof createClient>>

function parseId(value: unknown) {
  const result = z.uuid().safeParse(value)
  return result.success ? result.data : null
}

function fieldError(field: string, message: string): FormState {
  return { status: "error", fieldErrors: { [field]: [message] } }
}

/** Every entry of one holding: an account's coins of one market. */
async function loadPosition(
  supabase: Supabase,
  brokerAccountId: string,
  market: string,
) {
  const { data, error } = await supabase
    .from("crypto_transactions")
    .select(POSITION_COLUMNS)
    .eq("broker_account_id", brokerAccountId)
    .eq("market", market)
  if (error) {
    throw new Error(`Couldn't check existing entries: ${error.message}`)
  }
  return data.map(toCryptoHoldingTransaction)
}

export async function searchCoinsAction(query: string): Promise<CoinOption[]> {
  return searchCoins(query)
}

export async function saveCryptoTransaction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()

  const memberId = parseId(formData.get("memberId"))
  if (!memberId) return actionError("This member no longer exists.")
  const rawId = formData.get("id")
  const id = rawId === null ? null : parseId(rawId)
  if (rawId !== null && !id) return actionError("This entry no longer exists.")

  const parsed = cryptoTransactionSchema.safeParse(Object.fromEntries(formData))
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
  if (!canHoldCrypto(account.broker)) {
    return fieldError(
      "brokerAccountId",
      "Choose the CoinDCX account (or an Other account) the coins are held on.",
    )
  }

  const { data: coin } = await supabase
    .from("crypto_assets")
    .select("symbol")
    .eq("market", input.market)
    .maybeSingle()
  if (!coin) return fieldError("market", "Choose a coin from the list.")

  let original: ReturnType<typeof toCryptoHoldingTransaction> | null = null
  if (id) {
    const { data, error } = await supabase
      .from("crypto_transactions")
      .select(POSITION_COLUMNS)
      .eq("id", id)
      .eq("member_id", memberId)
      .maybeSingle()
    if (error) return actionError(`Couldn't load this entry: ${error.message}`)
    if (!data) return actionError("This entry no longer exists.")
    original = toCryptoHoldingTransaction(data)
  }

  // Refuse changes that would sell more coins than held at any date.
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
      input.market,
    )
    const check = buildPosition([
      ...position.filter((entry) => entry.id !== id),
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
        original.market !== input.market)
    if (original && moved) {
      const previous = await loadPosition(
        supabase,
        original.brokerAccountId,
        original.market,
      )
      const previousCheck = buildPosition(
        previous.filter((entry) => entry.id !== id),
      )
      if (!previousCheck.ok) {
        return actionError(
          `Moving this entry would break a sell it currently covers. ${previousCheck.message}`,
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
    market: input.market,
    type: input.type,
    quantity: input.quantity,
    price: input.price,
    charges: input.charges,
    trade_date: input.tradeDate,
    notes: input.notes,
  }
  const { data, error } = id
    ? await supabase
        .from("crypto_transactions")
        .update(row)
        .eq("id", id)
        .eq("member_id", memberId)
        .select("id")
    : await supabase
        .from("crypto_transactions")
        .insert({ ...row, member_id: memberId })
        .select("id")

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return actionError("That account or coin no longer exists.")
    }
    return actionError(`Couldn't save: ${error.message}`)
  }
  if (data.length === 0) return actionError("This entry no longer exists.")

  refresh()
  const label = TRANSACTION_TYPE_LABELS[input.type].toLowerCase()
  return {
    status: "success",
    message: id
      ? `Saved ${label} of ${coin.symbol}.`
      : `Added ${label} of ${coin.symbol}.`,
  }
}

export async function deleteCryptoTransaction(
  transactionId: string,
): Promise<FormState> {
  await requireOwner()

  const id = parseId(transactionId)
  if (!id) return actionError("This entry no longer exists.")

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from("crypto_transactions")
    .select("broker_account_id, market, type, coin:crypto_assets(symbol)")
    .eq("id", id)
    .maybeSingle()
  if (error) return actionError(`Couldn't load this entry: ${error.message}`)
  if (!row) return actionError("This entry no longer exists.")

  try {
    const remaining = await loadPosition(
      supabase,
      row.broker_account_id,
      row.market,
    )
    const check = buildPosition(remaining.filter((entry) => entry.id !== id))
    if (!check.ok) {
      return actionError(
        `Can't delete: a later sell needs these coins. Change or delete that sell first. (${check.message})`,
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
    .from("crypto_transactions")
    .delete()
    .eq("id", id)
  if (deleteError) {
    return actionError(`Couldn't delete: ${deleteError.message}`)
  }

  refresh()
  return {
    status: "success",
    message: `Deleted ${TRANSACTION_TYPE_LABELS[row.type].toLowerCase()} of ${row.coin.symbol}.`,
  }
}
