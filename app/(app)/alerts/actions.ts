"use server"

import { randomInt } from "node:crypto"

import { refresh } from "next/cache"
import { z } from "zod"

import {
  actionError,
  type FormState,
  validationError,
} from "@/lib/action-state"
import { deliverAlert, loadTelegramSettings } from "@/lib/alerts/deliver"
import { describeRule } from "@/lib/alerts/rules"
import {
  alertPreferencesSchema,
  alertRuleSchema,
  MAX_ALERT_RULES,
} from "@/lib/alerts/schema"
import { requireOwner } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  findStartMessage,
  getBotUsername,
  getTelegramToken,
} from "@/lib/telegram/client"

const LINK_CODE_MINUTES = 15

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

// Linking the chat ------------------------------------------------------------------

export type TelegramLink =
  | { status: "ready"; url: string; botName: string }
  | { status: "error"; message: string }

/** Makes a one-time link that opens the bot and sends "/start <code>". */
export async function startTelegramLink(): Promise<TelegramLink> {
  await requireOwner()
  if (!getTelegramToken()) {
    return {
      status: "error",
      message: "Add TELEGRAM_BOT_TOKEN first (see README).",
    }
  }

  try {
    const botName = await getBotUsername()
    const code = String(randomInt(100_000, 1_000_000))
    const supabase = await createClient()
    const { error } = await supabase
      .from("telegram_settings")
      .update({
        link_code: code,
        link_code_expires_at: new Date(
          Date.now() + LINK_CODE_MINUTES * 60_000,
        ).toISOString(),
      })
      .eq("singleton", true)
    if (error)
      return { status: "error", message: `Couldn't start: ${error.message}` }
    return {
      status: "ready",
      url: `https://t.me/${botName}?start=${code}`,
      botName,
    }
  } catch (error) {
    return {
      status: "error",
      message: messageOf(error, "Couldn't reach Telegram."),
    }
  }
}

/** Looks for the "/start <code>" message and saves that chat. */
export async function finishTelegramLink(): Promise<FormState> {
  await requireOwner()
  const supabase = await createClient()

  try {
    const settings = await loadTelegramSettings(supabase)
    const code = settings?.link_code
    if (
      !code ||
      !settings.link_code_expires_at ||
      Date.parse(settings.link_code_expires_at) < Date.now()
    ) {
      return actionError("The link has expired. Press Connect Telegram again.")
    }

    const chat = await findStartMessage(code)
    if (!chat) {
      return actionError(
        "No Start message yet. Open the link, press Start in Telegram, then try again.",
      )
    }

    const { error } = await supabase
      .from("telegram_settings")
      .update({
        chat_id: chat.chatId,
        chat_name: chat.name,
        link_code: null,
        link_code_expires_at: null,
      })
      .eq("singleton", true)
    if (error) return actionError(`Couldn't save the chat: ${error.message}`)

    await deliverAlert(
      supabase,
      { ...settings, chat_id: chat.chatId },
      {
        kind: "test",
        message:
          "✅ Family Portfolio is connected. Price alerts, the daily summary and problem alerts will arrive here.",
        ignoreQuietHours: true,
      },
    )
    refresh()
    return {
      status: "success",
      message: `Connected to ${chat.name}'s Telegram.`,
    }
  } catch (error) {
    return actionError(messageOf(error, "Couldn't reach Telegram."))
  }
}

export async function sendTestAlert(): Promise<FormState> {
  await requireOwner()
  const supabase = await createClient()
  const settings = await loadTelegramSettings(supabase)
  const sent = await deliverAlert(supabase, settings, {
    kind: "test",
    message:
      "🔔 Test alert from Family Portfolio. Alerts will arrive like this.",
    ignoreQuietHours: true,
  })
  refresh()
  return sent
    ? { status: "success", message: "Test alert sent. Check Telegram." }
    : actionError("Couldn't send it. See Recent alerts below for why.")
}

export async function disconnectTelegram(): Promise<FormState> {
  await requireOwner()
  const supabase = await createClient()
  const { error } = await supabase
    .from("telegram_settings")
    .update({ chat_id: null, chat_name: null, link_code: null })
    .eq("singleton", true)
  if (error) return actionError(`Couldn't disconnect: ${error.message}`)
  refresh()
  return {
    status: "success",
    message: "Telegram disconnected. No alerts will be sent.",
  }
}

// Preferences ------------------------------------------------------------------

export async function saveAlertPreferences(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()
  const parsed = alertPreferencesSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const { dailySummary, systemAlerts, quietStart, quietEnd } = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from("telegram_settings")
    .update({
      daily_summary: dailySummary,
      system_alerts: systemAlerts,
      quiet_start: quietStart,
      quiet_end: quietEnd,
    })
    .eq("singleton", true)
  if (error) return actionError(`Couldn't save: ${error.message}`)
  refresh()
  return { status: "success", message: "Alert settings saved." }
}

// Price alerts -------------------------------------------------------------------

export async function saveAlertRule(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOwner()
  const parsed = alertRuleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return validationError(parsed.error)
  const rule = parsed.data

  const supabase = await createClient()
  const [{ data: instrument }, { count, error: countError }] =
    await Promise.all([
      supabase
        .from("instruments")
        .select("symbol, kind")
        .eq("id", rule.instrumentId)
        .maybeSingle(),
      supabase.from("alert_rules").select("id", { count: "exact", head: true }),
    ])
  if (!instrument || instrument.kind === "index") {
    return {
      status: "error",
      fieldErrors: { instrumentId: ["Choose a stock from the list."] },
    }
  }
  if (countError)
    return actionError(`Couldn't check alerts: ${countError.message}`)
  if ((count ?? 0) >= MAX_ALERT_RULES) {
    return actionError(
      `There are already ${MAX_ALERT_RULES} price alerts. Delete some first.`,
    )
  }

  const { error } = await supabase.from("alert_rules").insert({
    instrument_id: rule.instrumentId,
    kind: rule.kind,
    threshold: rule.threshold,
    note: rule.note,
  })
  if (error) return actionError(`Couldn't save: ${error.message}`)

  refresh()
  return {
    status: "success",
    message: `Alert added: ${instrument.symbol} ${describeRule(rule).toLowerCase()}.`,
  }
}

function parseId(value: string) {
  const result = z.uuid().safeParse(value)
  return result.success ? result.data : null
}

export async function setAlertRuleActive(
  ruleId: string,
  active: boolean,
): Promise<FormState> {
  await requireOwner()
  const id = parseId(ruleId)
  if (!id) return actionError("This alert no longer exists.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("alert_rules")
    .update({ is_active: active })
    .eq("id", id)
    .select("id")
  if (error) return actionError(`Couldn't update: ${error.message}`)
  if (data.length === 0) return actionError("This alert no longer exists.")
  refresh()
  return {
    status: "success",
    message: active ? "Alert resumed." : "Alert paused.",
  }
}

export async function deleteAlertRule(ruleId: string): Promise<FormState> {
  await requireOwner()
  const id = parseId(ruleId)
  if (!id) return actionError("This alert no longer exists.")

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("alert_rules")
    .delete()
    .eq("id", id)
    .select("id")
  if (error) return actionError(`Couldn't delete: ${error.message}`)
  if (data.length === 0) return actionError("This alert no longer exists.")
  refresh()
  return { status: "success", message: "Alert deleted." }
}
