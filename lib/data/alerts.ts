import "server-only"

import {
  loadTelegramSettings,
  type TelegramSettings,
} from "@/lib/alerts/deliver"
import type { AlertKind } from "@/lib/alerts/rules"
import { requireOwner } from "@/lib/auth"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export type AlertRuleRow = {
  id: string
  kind: AlertKind
  threshold: number | null
  note: string | null
  isActive: boolean
  lastTriggeredAt: string | null
  instrument: Pick<Tables<"instruments">, "id" | "exchange" | "symbol" | "kind">
  lastPrice: number | null
}

export type AlertEvent = Pick<
  Tables<"alert_events">,
  "id" | "kind" | "message" | "delivered" | "error" | "sent_at"
>

export async function getTelegramSettings(): Promise<TelegramSettings | null> {
  await requireOwner()
  return loadTelegramSettings(await createClient())
}

/** Every price alert with its stock's latest saved price, by symbol. */
export async function listAlertRules(): Promise<AlertRuleRow[]> {
  await requireOwner()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("alert_rules")
    .select(
      "id, kind, threshold, note, is_active, last_triggered_at, instrument:instruments(id, exchange, symbol, kind)",
    )
  if (error) throw new Error(`Couldn't load price alerts: ${error.message}`)

  const ids = [...new Set(data.map((rule) => rule.instrument.id))]
  const { data: prices, error: priceError } =
    ids.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("instrument_prices")
          .select("instrument_id, last_price")
          .in("instrument_id", ids)
  if (priceError) throw new Error(`Couldn't load prices: ${priceError.message}`)
  const lastPrices = new Map(
    (prices ?? []).map((price) => [
      price.instrument_id,
      Number(price.last_price),
    ]),
  )

  return data
    .map((rule) => ({
      id: rule.id,
      kind: rule.kind,
      threshold: rule.threshold === null ? null : Number(rule.threshold),
      note: rule.note,
      isActive: rule.is_active,
      lastTriggeredAt: rule.last_triggered_at,
      instrument: rule.instrument,
      lastPrice: lastPrices.get(rule.instrument.id) ?? null,
    }))
    .sort((a, b) => a.instrument.symbol.localeCompare(b.instrument.symbol))
}

/** The latest alerts sent or held back, newest first. */
export async function listAlertEvents(limit = 30): Promise<AlertEvent[]> {
  await requireOwner()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("alert_events")
    .select("id, kind, message, delivered, error, sent_at")
    .order("sent_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Couldn't load recent alerts: ${error.message}`)
  return data
}
