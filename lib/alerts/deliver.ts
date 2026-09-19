import "server-only"

import { isQuietHours } from "@/lib/alerts/rules"
import { todayInIndia } from "@/lib/dates"
import type { Tables } from "@/lib/supabase/database.types"
import type { AppSupabaseClient } from "@/lib/supabase/types"
import { getTelegramToken, sendTelegramMessage } from "@/lib/telegram/client"

export type TelegramSettings = Tables<"telegram_settings">
export type AlertEventKind = "price" | "summary" | "system" | "test"

export async function loadTelegramSettings(
  supabase: AppSupabaseClient,
): Promise<TelegramSettings | null> {
  const { data, error } = await supabase
    .from("telegram_settings")
    .select("*")
    .maybeSingle()
  if (error) throw new Error(`Couldn't load alert settings: ${error.message}`)
  return data
}

/** True once the bot token is set and a chat is linked. */
export function telegramReady(
  settings: TelegramSettings | null,
): settings is TelegramSettings & { chat_id: number } {
  return getTelegramToken() !== null && settings?.chat_id != null
}

/**
 * Sends an alert to the linked chat and records it on the Alerts page. During
 * quiet hours it's recorded as held back instead. Returns whether it was sent.
 */
export async function deliverAlert(
  supabase: AppSupabaseClient,
  settings: TelegramSettings | null,
  {
    kind,
    message,
    ruleId = null,
    now = new Date(),
    ignoreQuietHours = false,
  }: {
    kind: AlertEventKind
    message: string
    ruleId?: string | null
    now?: Date
    ignoreQuietHours?: boolean
  },
): Promise<boolean> {
  let problem: string | null = null
  if (!telegramReady(settings)) {
    problem = "Telegram isn't connected."
  } else if (
    !ignoreQuietHours &&
    isQuietHours(
      now,
      settings.quiet_start.slice(0, 5),
      settings.quiet_end.slice(0, 5),
    )
  ) {
    problem = "Held back: quiet hours."
  } else {
    try {
      await sendTelegramMessage(settings.chat_id, message)
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error)
    }
  }

  const { error } = await supabase.from("alert_events").insert({
    rule_id: ruleId,
    kind,
    message,
    delivered: problem === null,
    error: problem,
  })
  if (error) console.error(`Couldn't record an alert: ${error.message}`)
  return problem === null
}

/**
 * Tells the owner something broke, e.g. a failed job or Angel One login. The
 * same message goes out at most once a day. Never throws.
 */
export async function notifySystem(
  supabase: AppSupabaseClient,
  message: string,
): Promise<void> {
  try {
    const settings = await loadTelegramSettings(supabase)
    if (!settings?.system_alerts || !telegramReady(settings)) return

    const startOfDay = new Date(
      `${todayInIndia()}T00:00:00+05:30`,
    ).toISOString()
    const { count, error } = await supabase
      .from("alert_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "system")
      .eq("message", message)
      .gte("sent_at", startOfDay)
    if (error || (count ?? 0) > 0) return

    await deliverAlert(supabase, settings, { kind: "system", message })
  } catch (error) {
    console.error(
      `Couldn't send a system alert: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
