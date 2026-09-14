import { StatTile, toneOf } from "@/components/stat-tile"
import { formatINR, formatPercent, formatSignedINR } from "@/lib/format"
import type { PortfolioSummary } from "@/lib/portfolio/valuation"

export function PortfolioSummaryTiles({
  summary,
}: {
  summary: PortfolioSummary
}) {
  const priced = summary.pricedCount > 0
  const unpriced = summary.holdingCount - summary.pricedCount

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <StatTile
        hero
        className="sm:col-span-2"
        label="Current value"
        value={priced ? formatINR(summary.currentValue, 0) : "—"}
        delta={
          priced && summary.dayChangePct !== null
            ? `${formatSignedINR(summary.dayChange, 0)} (${formatPercent(summary.dayChangePct)}) today`
            : undefined
        }
        tone={toneOf(summary.dayChange)}
        hint={
          !priced
            ? "Update prices to see the current value."
            : unpriced > 0
              ? `${unpriced} of ${summary.holdingCount} holdings have no price yet and aren't included.`
              : undefined
        }
      />
      <StatTile
        label="Invested"
        value={formatINR(summary.invested, 0)}
        hint={`${summary.holdingCount} ${summary.holdingCount === 1 ? "holding" : "holdings"}, including charges`}
      />
      <StatTile
        label="Unrealised P&L"
        value={priced ? formatSignedINR(summary.unrealizedPnl, 0) : "—"}
        delta={
          priced && summary.unrealizedPct !== null
            ? `${formatPercent(summary.unrealizedPct)} on invested`
            : undefined
        }
        tone={toneOf(summary.unrealizedPnl)}
      />
      <StatTile
        label="Booked from sells"
        value={formatSignedINR(summary.realizedPnl, 0)}
        hint="After charges"
      />
    </div>
  )
}
