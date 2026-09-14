import { todayInIndia } from "@/lib/dates"
import type { PortfolioSummary, Price } from "@/lib/portfolio/valuation"

export type SnapshotRow = {
  member_id: string
  snapshot_date: string
  holding_count: number
  priced_count: number
  invested: number
  current_value: number
  unrealized_pnl: number
  realized_pnl: number
}

export type EodRow = {
  instrument_id: number
  price_date: string
  close_price: number
}

const toPaise = (value: number) => Math.round(value * 100) / 100

/** One portfolio snapshot row per member for `date` (YYYY-MM-DD, India). */
export function buildSnapshotRows(
  members: readonly { memberId: string; summary: PortfolioSummary }[],
  date: string,
): SnapshotRow[] {
  return members.map(({ memberId, summary }) => ({
    member_id: memberId,
    snapshot_date: date,
    holding_count: summary.holdingCount,
    priced_count: summary.pricedCount,
    invested: toPaise(summary.invested),
    current_value: toPaise(summary.currentValue),
    unrealized_pnl: toPaise(summary.unrealizedPnl),
    realized_pnl: toPaise(summary.realizedPnl),
  }))
}

/**
 * Closing prices for `date`: only prices fetched from Angel One on that India
 * date count. Hand-entered or older prices aren't a reliable close, so they're skipped.
 */
export function buildEodRows(
  prices: readonly { instrumentId: number; price: Price }[],
  date: string,
): EodRow[] {
  const rows = new Map<number, EodRow>()
  for (const { instrumentId, price } of prices) {
    if (price.source !== "angelone") continue
    if (todayInIndia(new Date(price.pricedAt)) !== date) continue
    rows.set(instrumentId, {
      instrument_id: instrumentId,
      price_date: date,
      close_price: price.lastPrice,
    })
  }
  return [...rows.values()]
}
