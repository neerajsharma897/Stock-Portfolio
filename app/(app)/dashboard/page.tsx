import { LayoutDashboardIcon, TriangleAlertIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { MemberSplit } from "@/app/(app)/dashboard/member-split"
import { TopMovers } from "@/app/(app)/dashboard/top-movers"
import { PageHeader } from "@/components/layout/page-header"
import { LivePrices } from "@/components/live-prices"
import { PortfolioSummaryTiles } from "@/components/portfolio-summary-tiles"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { UpdatePricesDialog } from "@/components/update-prices-dialog"
import { getFamilyPortfolio } from "@/lib/data/portfolio"
import { getLiveStatus } from "@/lib/prices/live"

export const metadata: Metadata = { title: "Dashboard" }

export default async function DashboardPage() {
  const [portfolio, liveStatus] = await Promise.all([
    getFamilyPortfolio(),
    getLiveStatus(),
  ])
  const { members, summary, instruments, priceItems, movers } = portfolio

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
                : "Open a member and add an opening balance for each stock they hold. Family totals will appear here."}
            </p>
            <Button asChild>
              <Link href="/members">Go to members</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  const membersWithProblems = members.filter(
    (memberPortfolio) => memberPortfolio.problems.length > 0,
  )

  return (
    <>
      <PageHeader
        title="Family dashboard"
        description="Everyone's investments at a glance."
      >
        <div className="flex flex-wrap items-center gap-3">
          <LivePrices initialStatus={liveStatus} />
          <UpdatePricesDialog items={priceItems} />
        </div>
      </PageHeader>

      {membersWithProblems.length > 0 && (
        <div
          role="alert"
          className="mb-4 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
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

      <PortfolioSummaryTiles summary={summary} />

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MemberSplit members={members} familyValue={summary.currentValue} />
        </div>
        <TopMovers movers={movers} instruments={instruments} />
      </div>
    </>
  )
}
