import { LayoutDashboardIcon, TriangleAlertIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { AssetSplit } from "@/app/(app)/dashboard/asset-split"
import { MemberSplit } from "@/app/(app)/dashboard/member-split"
import {
  NiftyComparison,
  NiftyComparisonSkeleton,
} from "@/app/(app)/dashboard/nifty-comparison"
import { TopMovers } from "@/app/(app)/dashboard/top-movers"
import { PageHeader } from "@/components/layout/page-header"
import { LiveCryptoPrices } from "@/components/live-crypto-prices"
import { LivePrices } from "@/components/live-prices"
import { PortfolioSummaryTiles } from "@/components/portfolio-summary-tiles"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UpdatePricesDialog } from "@/components/update-prices-dialog"
import {
  ValueHistoryChart,
  type HistoryPoint,
} from "@/components/value-history-chart"
import { getValueHistory } from "@/lib/data/insights"
import { getFamilyPortfolio } from "@/lib/data/portfolio"
import { overallReturn } from "@/lib/portfolio/overall-return"
import { getLiveStatus } from "@/lib/prices/live"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const [portfolio, liveStatus] = await Promise.all([
    getFamilyPortfolio(),
    getLiveStatus(),
  ])
  const {
    members,
    summary,
    xirr,
    assetClasses,
    cryptoSummary,
    instruments,
    priceItems,
    movers,
  } = portfolio

  const hasActivity = summary.holdingCount > 0 || summary.realizedPnl !== 0
  if (members.length === 0 || !hasActivity) {
    return (
      <>
        <PageHeader
          title="Family dashboard"
          description="Everyone's investments at a glance."
        />
        <Card className="border-dashed">
          <CardContent className="grid justify-items-center gap-3 py-10 text-center">
            <LayoutDashboardIcon
              className="size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="font-medium">
              {members.length === 0
                ? "No family members yet"
                : "No holdings yet"}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {members.length === 0
                ? "Add each family member and their broker accounts first."
                : "Open a member and add what they hold: stocks, mutual funds, crypto, FDs or other assets. Family totals will appear here."}
            </p>
            <Button asChild>
              <Link href="/members">Go to members</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  // Daily snapshots, plus today's value while it's a trading day.
  const history: HistoryPoint[] = await getValueHistory(
    members.map(({ member }) => member.id),
  )
  const market = liveStatus.market
  if (market.reason === "open" || market.reason === "after_close") {
    const today = {
      date: market.date,
      value: summary.currentValue,
      invested: summary.invested,
    }
    if (history.at(-1)?.date === market.date)
      history[history.length - 1] = today
    else history.push(today)
  }

  const stockHoldings = members.flatMap((portfolio) => portfolio.holdings)
  const stockSummary = assetClasses.find(
    (assetClass) => assetClass.key === "stocks",
  )?.summary

  const membersWithProblems = members.filter(
    (memberPortfolio) =>
      memberPortfolio.problems.length > 0 ||
      memberPortfolio.fundProblems.length > 0 ||
      memberPortfolio.cryptoProblems.length > 0,
  )

  return (
    <>
      <PageHeader
        title="Family dashboard"
        description="Everyone's investments at a glance."
      >
        <div className="flex flex-wrap items-center gap-3">
          <LivePrices initialStatus={liveStatus} />
          {cryptoSummary.holdingCount > 0 && (
            <LiveCryptoPrices initialPricedAt={cryptoSummary.latestPricedAt} />
          )}
          <UpdatePricesDialog items={priceItems} />
        </div>
      </PageHeader>

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
            Some entries don&apos;t add up for{" "}
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
            <CardTitle>Family value over time</CardTitle>
            <CardDescription>
              Everything together at each trading day&apos;s close, from the
              daily snapshots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {history.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                The chart fills in as the daily snapshot runs after each trading
                day.
              </p>
            ) : (
              <ValueHistoryChart points={history} />
            )}
          </CardContent>
        </Card>
        {stockSummary && stockSummary.holdingCount > 0 && (
          <Suspense fallback={<NiftyComparisonSkeleton />}>
            <NiftyComparison
              flows={stockHoldings.flatMap((holding) => holding.flows)}
              stockValue={stockSummary.currentValue}
              stockXirr={overallReturn(
                {
                  holdings: stockHoldings,
                  funds: [],
                  crypto: [],
                  deposits: [],
                },
                market.date,
              )}
              allPriced={stockSummary.pricedCount === stockSummary.holdingCount}
            />
          </Suspense>
        )}
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MemberSplit members={members} familyValue={summary.currentValue} />
        </div>
        <div className="grid content-start gap-2">
          <AssetSplit
            assetClasses={assetClasses}
            familyValue={summary.currentValue}
          />
          <TopMovers movers={movers} instruments={instruments} />
        </div>
      </div>
    </>
  )
}
