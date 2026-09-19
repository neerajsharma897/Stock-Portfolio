import "server-only"

import { sendDailySummary } from "@/lib/alerts/run"
import { getAngelOneConfig } from "@/lib/angelone/config"
import { fetchAndSaveCoinPrices } from "@/lib/crypto/coindcx"
import { fetchMarketHolidays } from "@/lib/data/holidays"
import { buildFamilyPortfolio } from "@/lib/data/portfolio"
import type { JobOutcome } from "@/lib/jobs/run"
import { buildEodRows, buildSnapshotRows } from "@/lib/jobs/snapshot-rows"
import { getMarketStatus } from "@/lib/market-hours"
import type { Price } from "@/lib/portfolio/valuation"
import { fetchAndSavePrices } from "@/lib/prices/save"
import type { AppSupabaseClient } from "@/lib/supabase/types"

const AUDIT_KEEP_DAYS = 366
const ALERTS_KEEP_DAYS = 90
const JOB_RUNS_KEEP_DAYS = 60
const DAY_MS = 86_400_000

/**
 * After the market closes: fetch closing prices (when Angel One is set up) and
 * crypto prices, then save each stock's close and each member's portfolio for the day.
 * Safe to run more than once a day: rows for the same date are overwritten.
 */
export async function runDailySnapshot(
  supabase: AppSupabaseClient,
): Promise<JobOutcome> {
  const holidays = await fetchMarketHolidays(supabase)
  const market = getMarketStatus(
    new Date(),
    new Map(holidays.map((holiday) => [holiday.date, holiday.description])),
  )

  if (market.reason === "weekend") {
    return { status: "skipped", summary: "Weekend: no trading." }
  }
  if (market.reason === "holiday") {
    return { status: "skipped", summary: `Market holiday: ${market.holiday}.` }
  }
  if (market.reason === "before_open") {
    return {
      status: "skipped",
      summary:
        "The market hasn't opened yet today; the snapshot runs after 3:30 PM.",
    }
  }
  if (market.reason !== "after_close") {
    return {
      status: "skipped",
      summary: "The market is still open; the snapshot runs after 3:30 PM.",
    }
  }

  const notes: string[] = []
  const priceErrors: string[] = []
  const config = getAngelOneConfig()
  if (config) {
    try {
      const { saved } = await fetchAndSavePrices(supabase, config)
      notes.push(`${saved} closing prices fetched from Angel One`)
    } catch (error) {
      priceErrors.push(error instanceof Error ? error.message : String(error))
      notes.push("Angel One prices failed, so saved prices were used")
    }
  } else {
    notes.push("Angel One isn't set up, so saved prices were used")
  }

  try {
    const { saved } = await fetchAndSaveCoinPrices(supabase)
    if (saved > 0) notes.push(`${saved} crypto prices fetched from CoinDCX`)
  } catch (error) {
    priceErrors.push(error instanceof Error ? error.message : String(error))
    notes.push("CoinDCX prices failed, so saved crypto prices were used")
  }

  const portfolio = await buildFamilyPortfolio(supabase)

  const snapshotRows = buildSnapshotRows(
    portfolio.members.map(({ member, summary }) => ({
      memberId: member.id,
      summary,
    })),
    market.date,
  )
  if (snapshotRows.length > 0) {
    const { error } = await supabase
      .from("portfolio_snapshots")
      .upsert(snapshotRows, { onConflict: "member_id,snapshot_date" })
    if (error) throw new Error(`Couldn't save snapshots: ${error.message}`)
  }

  const prices = portfolio.members.flatMap(({ holdings }) =>
    holdings.flatMap((holding) =>
      holding.price
        ? [
            {
              instrumentId: holding.instrumentId,
              price: holding.price as Price,
            },
          ]
        : [],
    ),
  )
  const eodRows = buildEodRows(prices, market.date)
  if (eodRows.length > 0) {
    const { error } = await supabase
      .from("eod_prices")
      .upsert(eodRows, { onConflict: "instrument_id,price_date" })
    if (error) throw new Error(`Couldn't save closing prices: ${error.message}`)
  }

  notes.push(
    `${snapshotRows.length} member snapshots`,
    `${eodRows.length} closing prices saved`,
  )

  // In case the alerts job didn't run after the close.
  try {
    notes.push(await sendDailySummary(supabase))
  } catch (error) {
    notes.push(
      `daily summary failed (${error instanceof Error ? error.message : String(error)})`,
    )
  }

  // Keep a year of audit entries, 90 days of alerts and 60 days of job runs.
  const cutoff = (days: number) =>
    new Date(Date.now() - days * DAY_MS).toISOString()
  const pruned = await Promise.all([
    supabase
      .from("audit_log")
      .delete()
      .lt("changed_at", cutoff(AUDIT_KEEP_DAYS)),
    supabase
      .from("alert_events")
      .delete()
      .lt("sent_at", cutoff(ALERTS_KEEP_DAYS)),
    supabase
      .from("job_runs")
      .delete()
      .lt("started_at", cutoff(JOB_RUNS_KEEP_DAYS)),
  ])
  const pruneError = pruned.find((result) => result.error)?.error
  if (pruneError) {
    notes.push(`old entries weren't deleted (${pruneError.message})`)
  }
  return {
    status: priceErrors.length > 0 ? "failed" : "success",
    summary: notes.join(" · "),
    error: priceErrors.length > 0 ? priceErrors.join(" · ") : null,
  }
}
