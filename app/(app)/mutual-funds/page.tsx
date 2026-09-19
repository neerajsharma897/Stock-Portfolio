import { LandmarkIcon, TriangleAlertIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { FundName } from "@/components/fund-name"
import { PageHeader } from "@/components/layout/page-header"
import { MemberAvatar } from "@/components/member-avatar"
import { StatTile, toneOf, toneTextClass } from "@/components/stat-tile"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getFamilyPortfolio } from "@/lib/data/portfolio"
import {
  formatDate,
  formatINR,
  formatPercent,
  formatSignedINR,
} from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Mutual funds" }

export default async function MutualFundsPage() {
  const { members, fundSummary, fundXirr, schemes } = await getFamilyPortfolio()

  const rows = members
    .flatMap(({ member, funds }) =>
      funds
        .filter((fund) => fund.position.quantity > 0)
        .map((fund) => ({ member, fund, scheme: schemes.get(fund.amfiCode) })),
    )
    .sort((a, b) => (b.fund.currentValue ?? 0) - (a.fund.currentValue ?? 0))
  const membersWithProblems = members.filter(
    (portfolio) => portfolio.fundProblems.length > 0,
  )

  const header = (
    <PageHeader
      title="Mutual funds"
      description="Every family member's funds, valued at the latest NAV from AMFI."
    />
  )

  if (rows.length === 0 && fundSummary.realizedPnl === 0) {
    return (
      <>
        {header}
        <Card className="border-dashed">
          <CardContent className="grid justify-items-center gap-3 py-10 text-center">
            <LandmarkIcon
              className="size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="font-medium">No mutual funds yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Download the fund list in Settings, then open a member and add an
              opening balance for each fund they hold.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link href="/settings">Go to settings</Link>
              </Button>
              <Button asChild>
                <Link href="/members">Go to members</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  const regular = rows.filter((row) => row.scheme?.plan === "regular")
  const regularValue = regular.reduce(
    (sum, row) => sum + (row.fund.currentValue ?? 0),
    0,
  )
  const navDates = rows.flatMap((row) =>
    row.fund.price ? [row.fund.price.pricedAt] : [],
  )
  const latestNavDate = navDates.length > 0 ? navDates.sort().at(-1)! : null
  const valued = fundSummary.pricedCount > 0

  return (
    <>
      {header}

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
            Some fund entries don&apos;t add up for{" "}
            {membersWithProblems.map((portfolio, index) => (
              <span key={portfolio.member.id}>
                {index > 0 && ", "}
                <Link
                  href={`/members/${portfolio.member.id}`}
                  className="font-medium underline underline-offset-4"
                >
                  {portfolio.member.name}
                </Link>
              </span>
            ))}
            . Those funds are left out of the totals until fixed.
          </p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          hero
          className="sm:col-span-2"
          label="Current value"
          value={valued ? formatINR(fundSummary.currentValue, 0) : "—"}
          delta={
            valued && fundSummary.dayChangePct !== null
              ? `${formatSignedINR(fundSummary.dayChange, 0)} (${formatPercent(fundSummary.dayChangePct)}) on the latest NAV`
              : undefined
          }
          tone={toneOf(fundSummary.dayChange)}
          hint={
            latestNavDate
              ? `NAVs as of ${formatDate(latestNavDate)}.`
              : "Update the fund list in Settings to get NAVs."
          }
        />
        <StatTile
          label="Invested"
          value={formatINR(fundSummary.invested, 0)}
          hint={`${fundSummary.holdingCount} ${fundSummary.holdingCount === 1 ? "fund" : "funds"}, including charges`}
        />
        <StatTile
          label="Returns"
          value={valued ? formatSignedINR(fundSummary.unrealizedPnl, 0) : "—"}
          delta={
            valued && fundSummary.unrealizedPct !== null
              ? `${formatPercent(fundSummary.unrealizedPct)} on invested`
              : undefined
          }
          tone={toneOf(fundSummary.unrealizedPnl)}
          hint={
            fundSummary.realizedPnl !== 0
              ? `${formatSignedINR(fundSummary.realizedPnl, 0)} booked from redemptions`
              : undefined
          }
        />
        <StatTile
          label="XIRR"
          value={fundXirr !== null ? formatPercent(fundXirr * 100) : "—"}
          hint={
            fundXirr !== null
              ? "Yearly return, allowing for when money went in and out"
              : "Shown once money has been invested for a year"
          }
        />
      </div>

      {regular.length > 0 && (
        <Card className="mt-2">
          <CardContent className="grid gap-1 text-sm">
            <p className="font-medium">
              {regular.length}{" "}
              {regular.length === 1 ? "holding is" : "holdings are"} in Regular
              plans
              {regularValue > 0 && ` (${formatINR(regularValue, 0)})`}
            </p>
            <p className="text-muted-foreground">
              Regular plans include a distributor commission in their expense
              ratio; the Direct plan of the same fund doesn&apos;t. They&apos;re
              marked &ldquo;Regular&rdquo; below.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mt-2">
        <CardHeader>
          <CardTitle>All funds</CardTitle>
          <CardDescription>
            {rows.length} {rows.length === 1 ? "holding" : "holdings"}, largest
            first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative -mx-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Member
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Fund
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Current value
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Returns
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(({ member, fund, scheme }) => {
                  const pnlTone = toneTextClass(toneOf(fund.unrealizedPnl))
                  return (
                    <tr
                      key={`${member.id}:${fund.brokerAccountId}:${fund.amfiCode}`}
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/members/${member.id}`}
                          className="flex items-center gap-2 font-medium hover:underline"
                        >
                          <MemberAvatar
                            name={member.name}
                            color={member.color}
                          />
                          {member.name}
                        </Link>
                      </td>
                      <td className="max-w-96 px-4 py-2.5">
                        <FundName
                          scheme={scheme}
                          detail={scheme?.category ?? undefined}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fund.currentValue !== null
                          ? formatINR(fund.currentValue)
                          : "—"}
                        <div className="text-xs text-muted-foreground">
                          {formatINR(fund.position.invested)} invested
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fund.unrealizedPnl !== null ? (
                          <>
                            <div className={cn("font-medium", pnlTone)}>
                              {formatSignedINR(fund.unrealizedPnl)}
                            </div>
                            {fund.unrealizedPct !== null && (
                              <div className={cn("text-xs", pnlTone)}>
                                {formatPercent(fund.unrealizedPct)}
                              </div>
                            )}
                            {fund.xirr !== null && (
                              <div className="text-xs text-muted-foreground">
                                {formatPercent(fund.xirr * 100)} XIRR
                              </div>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
