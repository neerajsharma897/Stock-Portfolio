import { describe, expect, it } from "vitest"

import { buildEodRows, buildSnapshotRows } from "@/lib/jobs/snapshot-rows"
import type { PortfolioSummary, Price } from "@/lib/portfolio/valuation"

const summary: PortfolioSummary = {
  holdingCount: 3,
  pricedCount: 2,
  invested: 150000.456,
  pricedInvested: 100000,
  currentValue: 112345.678,
  unrealizedPnl: 12345.678,
  unrealizedPct: 12.35,
  dayChange: 500,
  dayChangePct: 0.45,
  realizedPnl: -250.004,
  latestPricedAt: "2026-09-14T11:05:00Z",
}

describe("buildSnapshotRows", () => {
  it("maps each member's summary to a row, rounded to paise", () => {
    expect(
      buildSnapshotRows([{ memberId: "m1", summary }], "2026-09-14"),
    ).toEqual([
      {
        member_id: "m1",
        snapshot_date: "2026-09-14",
        holding_count: 3,
        priced_count: 2,
        invested: 150000.46,
        current_value: 112345.68,
        unrealized_pnl: 12345.68,
        realized_pnl: -250,
      },
    ])
  })
})

describe("buildEodRows", () => {
  const price = (
    source: Price["source"],
    pricedAt: string,
    lastPrice = 100,
  ): Price => ({ lastPrice, previousClose: 99, pricedAt, source })

  it("keeps only Angel One prices fetched on that India date, once per stock", () => {
    expect(
      buildEodRows(
        [
          // 11:05 UTC = 4:35 PM India on 14 Sept: kept.
          {
            instrumentId: 1,
            price: price("angelone", "2026-09-14T11:05:00Z", 2850),
          },
          {
            instrumentId: 1,
            price: price("angelone", "2026-09-14T11:06:00Z", 2851),
          },
          // Hand-entered: skipped.
          { instrumentId: 2, price: price("manual", "2026-09-14T11:05:00Z") },
          // Fetched the day before: skipped.
          { instrumentId: 3, price: price("angelone", "2026-09-13T11:00:00Z") },
        ],
        "2026-09-14",
      ),
    ).toEqual([
      { instrument_id: 1, price_date: "2026-09-14", close_price: 2851 },
    ])
  })
})
