import "server-only"

import {
  deliverAlert,
  loadTelegramSettings,
  telegramReady,
} from "@/lib/alerts/deliver"
import {
  firedToday,
  priceAlertMessage,
  ruleMet,
  type Holder,
} from "@/lib/alerts/rules"
import { dailySummaryMessage } from "@/lib/alerts/summary"
import { getAngelOneConfig } from "@/lib/angelone/config"
import { fetchMarketHolidays } from "@/lib/data/holidays"
import { buildFamilyPortfolio } from "@/lib/data/portfolio"
import type { JobOutcome } from "@/lib/jobs/run"
import { getMarketStatus, type MarketStatus } from "@/lib/market-hours"
import { fetchAndSavePrices } from "@/lib/prices/save"
import type { AppSupabaseClient } from "@/lib/supabase/types"

async function marketStatus(
  supabase: AppSupabaseClient,
  now: Date,
): Promise<MarketStatus> {
  const holidays = await fetchMarketHolidays(supabase)
  return getMarketStatus(
    now,
    new Map(holidays.map((holiday) => [holiday.date, holiday.description])),
  )
}

/** Who holds each stock, e.g. { 11536 → [Dad 20, Me 5] }. */
async function loadHolders(
  supabase: AppSupabaseClient,
): Promise<Map<number, Holder[]>> {
  const portfolio = await buildFamilyPortfolio(supabase)
  const holders = new Map<number, Holder[]>()
  for (const { member, holdings } of portfolio.members) {
    const byStock = new Map<number, number>()
    for (const holding of holdings) {
      if (holding.position.quantity <= 0) continue
      byStock.set(
        holding.instrumentId,
        (byStock.get(holding.instrumentId) ?? 0) + holding.position.quantity,
      )
    }
    for (const [instrumentId, quantity] of byStock) {
      const list = holders.get(instrumentId) ?? []
      list.push({ name: member.name, quantity })
      holders.set(instrumentId, list)
    }
  }
  return holders
}

/**
 * Checks every active price alert against the saved prices and sends the ones
 * that fire (each at most once a day). Owner's client or the admin client.
 */
export async function checkPriceAlerts(
  supabase: AppSupabaseClient,
  now: Date = new Date(),
): Promise<{ checked: number; sent: number }> {
  const settings = await loadTelegramSettings(supabase)
  if (!telegramReady(settings)) return { checked: 0, sent: 0 }

  const { data: rules, error } = await supabase
    .from("alert_rules")
    .select(
      "id, instrument_id, kind, threshold, note, last_triggered_at, instrument:instruments(symbol)",
    )
    .eq("is_active", true)
  if (error) throw new Error(`Couldn't load price alerts: ${error.message}`)
  if (rules.length === 0) return { checked: 0, sent: 0 }

  const { data: prices, error: priceError } = await supabase
    .from("instrument_prices")
    .select(
      "instrument_id, last_price, previous_close, week52_high, week52_low",
    )
    .in(
      "instrument_id",
      rules.map((rule) => rule.instrument_id),
    )
  if (priceError) throw new Error(`Couldn't load prices: ${priceError.message}`)
  const quotes = new Map(
    prices.map((price) => [
      price.instrument_id,
      {
        lastPrice: Number(price.last_price),
        previousClose:
          price.previous_close === null ? null : Number(price.previous_close),
        week52High:
          price.week52_high === null ? null : Number(price.week52_high),
        week52Low: price.week52_low === null ? null : Number(price.week52_low),
      },
    ]),
  )

  const due = rules.flatMap((row) => {
    const quote = quotes.get(row.instrument_id)
    const rule = {
      kind: row.kind,
      threshold: row.threshold === null ? null : Number(row.threshold),
      lastTriggeredAt: row.last_triggered_at,
    }
    return quote &&
      !firedToday(rule.lastTriggeredAt, now) &&
      ruleMet(rule, quote)
      ? [{ row, rule, quote }]
      : []
  })
  if (due.length === 0) return { checked: rules.length, sent: 0 }

  const holders = await loadHolders(supabase)
  let sent = 0
  for (const { row, rule, quote } of due) {
    const delivered = await deliverAlert(supabase, settings, {
      kind: "price",
      ruleId: row.id,
      now,
      message: priceAlertMessage({
        rule,
        symbol: row.instrument.symbol,
        quote,
        holders: holders.get(row.instrument_id) ?? [],
        note: row.note,
      }),
    })
    if (delivered) sent += 1
    // Marked even when held back by quiet hours, so it isn't retried all day.
    await supabase
      .from("alert_rules")
      .update({ last_triggered_at: now.toISOString() })
      .eq("id", row.id)
  }
  return { checked: rules.length, sent }
}

/**
 * Sends the market-close summary once per trading day, after 3:30 PM.
 * Returns what happened, for the job summary.
 */
export async function sendDailySummary(
  supabase: AppSupabaseClient,
  now: Date = new Date(),
  market?: MarketStatus,
): Promise<string> {
  const settings = await loadTelegramSettings(supabase)
  if (!telegramReady(settings)) return "Telegram isn't connected"
  if (!settings.daily_summary) return "daily summary is off"

  const status = market ?? (await marketStatus(supabase, now))
  if (status.reason !== "after_close")
    return "no summary: not after a trading day's close"
  if (settings.summary_sent_on === status.date)
    return "summary already sent today"

  const portfolio = await buildFamilyPortfolio(supabase)
  const message = dailySummaryMessage({
    now,
    family: portfolio.summary,
    members: portfolio.members.map(({ member, summary }) => ({
      name: member.name,
      summary,
    })),
    movers: portfolio.movers,
    symbolOf: (id) => portfolio.instruments.get(id)?.symbol ?? "Unknown",
  })
  const delivered = await deliverAlert(supabase, settings, {
    kind: "summary",
    message,
    now,
  })

  const { error } = await supabase
    .from("telegram_settings")
    .update({ summary_sent_on: status.date })
    .eq("singleton", true)
  if (error) throw new Error(`Couldn't record the summary: ${error.message}`)
  return delivered ? "daily summary sent" : "daily summary held back"
}

/**
 * The alerts job: during market hours (and once after the close) fetch prices,
 * check price alerts, then send the daily summary after the close.
 */
export async function runAlertsJob(
  supabase: AppSupabaseClient,
): Promise<JobOutcome> {
  const now = new Date()
  const market = await marketStatus(supabase, now)
  if (market.reason === "weekend" || market.reason === "holiday") {
    return { status: "skipped", summary: "Market closed today." }
  }
  if (market.reason === "before_open") {
    return { status: "skipped", summary: "Market not open yet." }
  }

  const settings = await loadTelegramSettings(supabase)
  if (!telegramReady(settings)) {
    return { status: "skipped", summary: "Telegram isn't connected." }
  }
  if (
    market.reason === "after_close" &&
    settings.summary_sent_on === market.date
  ) {
    return { status: "skipped", summary: "Done for today." }
  }

  const notes: string[] = []
  const config = getAngelOneConfig()
  let priceError: string | null = null
  if (config) {
    try {
      const { saved } = await fetchAndSavePrices(supabase, config)
      notes.push(`${saved} prices fetched`)
    } catch (error) {
      priceError = error instanceof Error ? error.message : String(error)
      notes.push("Angel One prices failed, so saved prices were checked")
    }
  }

  const { checked, sent } = await checkPriceAlerts(supabase, now)
  notes.push(`${checked} price alerts checked, ${sent} sent`)
  if (market.reason === "after_close") {
    notes.push(await sendDailySummary(supabase, now, market))
  }

  return {
    status: priceError ? "failed" : "success",
    summary: notes.join(" · "),
    error: priceError,
  }
}
