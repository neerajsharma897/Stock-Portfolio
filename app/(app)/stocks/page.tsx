import { ChartCandlestickIcon, TriangleAlertIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { TopMovers } from "@/app/(app)/dashboard/top-movers"
import {
  BrokerCard,
  ConcentrationCard,
  HoldingTermsCard,
  MonthlyFlowsCard,
  SectorCard,
  TaxFreeCard,
} from "@/app/(app)/stocks/insight-cards"
import { PageHeader } from "@/components/layout/page-header"
import { LivePrices } from "@/components/live-prices"
import { PortfolioSummaryTiles } from "@/components/portfolio-summary-tiles"
import { ShareList } from "@/components/share-list"
import { toneOf, toneTextClass } from "@/components/stat-tile"
import { StockChartDialog } from "@/components/stock-chart-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UpdatePricesDialog } from "@/components/update-prices-dialog"
import { getFamilyPortfolio } from "@/lib/data/portfolio"
import { getStockInsights } from "@/lib/data/stock-insights"
import { todayInIndia } from "@/lib/dates"
import {
  formatINR,
  formatPercent,
  formatQuantity,
  formatSignedINR,
} from "@/lib/format"
import { familyStocks } from "@/lib/portfolio/family-stocks"
import { overallReturn } from "@/lib/portfolio/overall-return"
import { summarize } from "@/lib/portfolio/valuation"
import { getLiveStatus } from "@/lib/prices/live"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Stocks" }

function NoPrice() {
  return (
    <span className="text-muted-foreground">
      —<span className="sr-only">no price yet</span>
    </span>
  )
}

export default async function StocksPage() {
  const [portfolio, liveStatus] = await Promise.all([
    getFamilyPortfolio(),
    getLiveStatus(),
  ])
  const { members, instruments, priceItems, movers } = portfolio

  const today = todayInIndia()
  const allHoldings = members.flatMap((member) => member.holdings)
  const summary = summarize(allHoldings)
  const xirr = overallReturn(
    { holdings: allHoldings, funds: [], crypto: [], deposits: [] },
    today,
  )
  const stocks = familyStocks(members)
  const insights = await getStockInsights(portfolio, stocks, today)
  const membersById = new Map(members.map(({ member }) => [member.id, member]))
  const memberRows = members
    .map(({ member, holdings }) => ({ member, summary: summarize(holdings) }))
    .filter((row) => row.summary.holdingCount > 0)
    .sort((a, b) => b.summary.currentValue - a.summary.currentValue)
  const membersWithProblems = members.filter(
    (memberPortfolio) => memberPortfolio.problems.length > 0,
  )

  const header = (live: boolean) => (
    <PageHeader
      title="Stocks"
      description="Every family member's shares, combined per stock."
    >
      {live && (
        <div className="flex flex-wrap items-center gap-3">
          <LivePrices initialStatus={liveStatus} />
          <UpdatePricesDialog items={priceItems} />
        </div>
      )}
    </PageHeader>
  )

  if (stocks.length === 0 && summary.realizedPnl === 0) {
    return (
      <>
        {header(false)}
        <Card className="border-dashed">
          <CardContent className="grid justify-items-center gap-3 py-10 text-center">
            <ChartCandlestickIcon
              className="size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="font-medium">No stocks yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Open a member, add their broker account, then add an opening
              balance for each stock they hold.
            </p>
            <Button asChild>
              <Link href="/members">Go to members</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      {header(stocks.length > 0)}

      {membersWithProblems.length > 0 && (
        <div
          role="alert"
          className="mb-2 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          <TriangleAlertIcon
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden
          />
          <p>
            Some stock entries don&apos;t add up for{" "}
            {membersWithProblems.map((memberPortfolio, index) => (
              <span key={memberPortfolio.member.id}>
                {index > 0 && ", "}
                <Link
                  href={`/members/${memberPortfolio.member.id}`}
                  className="font-medium underline underline-offset-4"
                >
                  {memberPortfolio.member.name}
                </Link>
              </span>
            ))}
            . Those holdings are left out of the totals until fixed.
          </p>
        </div>
      )}

      <PortfolioSummaryTiles summary={summary} xirr={xirr} />

      <div className="mt-2 grid gap-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All stocks</CardTitle>
            <CardDescription>
              {stocks.length === 0
                ? "No shares held right now."
                : `${stocks.length} ${stocks.length === 1 ? "stock" : "stocks"}, largest first. Tap a name for its chart.`}
            </CardDescription>
          </CardHeader>
          {stocks.length > 0 && (
            <CardContent>
              <div className="relative -mx-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="px-4 py-2 font-medium">
                        Stock
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-right font-medium"
                      >
                        Quantity
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-right font-medium"
                      >
                        Last price
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-right font-medium"
                      >
                        Current value
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-right font-medium"
                      >
                        P&amp;L
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stocks.map((stock) => {
                      const instrument = instruments.get(stock.instrumentId)
                      const symbol = instrument?.symbol ?? "Unknown"
                      const pnlTone = toneTextClass(toneOf(stock.unrealizedPnl))
                      return (
                        <tr key={stock.instrumentId}>
                          <td className="px-4 py-2.5">
                            <StockChartDialog
                              instrumentId={stock.instrumentId}
                              symbol={symbol}
                              exchange={instrument?.exchange ?? ""}
                              previousClose={stock.price?.previousClose ?? null}
                              livePrice={
                                stock.price
                                  ? {
                                      lastPrice: stock.price.lastPrice,
                                      pricedAt: stock.price.pricedAt,
                                    }
                                  : null
                              }
                              marketOpen={liveStatus.market.open}
                            />
                            <div className="text-xs text-muted-foreground">
                              {instrument?.exchange}
                              {instrument?.kind === "sgb" && " · Gold bond"}
                              {" · "}
                              {stock.holders
                                .map(
                                  (holder) =>
                                    `${membersById.get(holder.memberId)?.name ?? "Unknown"} ${formatQuantity(holder.quantity)}`,
                                )
                                .join(", ")}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {formatQuantity(stock.quantity)}
                            <div className="text-xs text-muted-foreground">
                              avg {formatINR(stock.averageCost)}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {stock.price ? (
                              <>
                                <div>{formatINR(stock.price.lastPrice)}</div>
                                {stock.dayChangePct !== null && (
                                  <div
                                    className={cn(
                                      "text-xs",
                                      toneTextClass(toneOf(stock.dayChange)),
                                    )}
                                  >
                                    {formatPercent(stock.dayChangePct)}
                                    <span className="sr-only"> today</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <NoPrice />
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {stock.currentValue !== null ? (
                              formatINR(stock.currentValue)
                            ) : (
                              <NoPrice />
                            )}
                            <div className="text-xs text-muted-foreground">
                              {stock.weightPct !== null
                                ? `${stock.weightPct.toFixed(1)}% of stocks`
                                : `${formatINR(stock.invested)} invested`}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {stock.unrealizedPnl !== null ? (
                              <>
                                <div className={cn("font-medium", pnlTone)}>
                                  {formatSignedINR(stock.unrealizedPnl)}
                                </div>
                                {stock.unrealizedPct !== null && (
                                  <div className={cn("text-xs", pnlTone)}>
                                    {formatPercent(stock.unrealizedPct)}
                                  </div>
                                )}
                                {stock.xirr !== null && (
                                  <div className="text-xs text-muted-foreground">
                                    {formatPercent(stock.xirr * 100)} XIRR
                                  </div>
                                )}
                              </>
                            ) : (
                              <NoPrice />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="grid content-start gap-2">
          <Card>
            <CardHeader>
              <CardTitle>By member</CardTitle>
              <CardDescription>Each member&apos;s stocks.</CardDescription>
            </CardHeader>
            <CardContent>
              <ShareList
                shareOf="of the family's stocks"
                rows={memberRows.map(({ member, summary: memberSummary }) => ({
                  key: member.id,
                  label: (
                    <Link
                      href={`/members/${member.id}`}
                      className="hover:underline"
                    >
                      {member.name}
                    </Link>
                  ),
                  value:
                    memberSummary.pricedCount > 0
                      ? formatINR(memberSummary.currentValue, 0)
                      : "—",
                  pct:
                    summary.currentValue > 0
                      ? (memberSummary.currentValue / summary.currentValue) *
                        100
                      : 0,
                  color: member.color,
                  detail:
                    memberSummary.dayChangePct !== null ? (
                      <span
                        className={toneTextClass(
                          toneOf(memberSummary.dayChange),
                        )}
                      >
                        {formatSignedINR(memberSummary.dayChange, 0)} today
                      </span>
                    ) : undefined,
                }))}
              />
            </CardContent>
          </Card>
          <TopMovers movers={movers} instruments={instruments} />
        </div>
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-3">
        <SectorCard
          slices={insights.sectors}
          instruments={instruments}
          loaded={insights.sectorsLoaded}
          missing={insights.sectorsMissing}
        />
        <ConcentrationCard
          concentration={insights.concentration}
          instruments={instruments}
        />
        <BrokerCard rows={insights.brokers} />
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-2">
        <HoldingTermsCard
          terms={insights.terms}
          instruments={instruments}
          membersById={membersById}
        />
        <TaxFreeCard
          rows={insights.taxFree.rows}
          yearLabel={insights.taxFree.yearLabel}
        />
      </div>

      <div className="mt-2">
        <MonthlyFlowsCard months={insights.months} />
      </div>
    </>
  )
}
