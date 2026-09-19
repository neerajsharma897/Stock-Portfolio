import { PiggyBankIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { StatTile, toneOf, toneTextClass } from "@/components/stat-tile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getFamilyPortfolio, type MemberPortfolio } from "@/lib/data/portfolio"
import { todayInIndia } from "@/lib/dates"
import { formatDate, formatINR, formatSignedINR } from "@/lib/format"
import {
  FD_INTEREST_LABELS,
  IPO_STATUS_LABELS,
  OTHER_ASSET_LABELS,
} from "@/lib/other-assets/options"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "FDs & other assets" }

const SOON_DAYS = 30
const DAY_MS = 86_400_000

function MemberTag({ member }: { member: MemberPortfolio["member"] }) {
  return (
    <Link
      href={`/members/${member.id}`}
      className="inline-flex items-center gap-1.5 hover:underline"
    >
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: member.color }}
        aria-hidden
      />
      {member.name}
    </Link>
  )
}

function daysUntil(date: string, today: string) {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      DAY_MS,
  )
}

export default async function OtherAssetsPage() {
  const { members } = await getFamilyPortfolio()
  const today = todayInIndia()

  const deposits = members
    .flatMap(({ member, deposits }) =>
      deposits
        .filter((deposit) => !deposit.closed)
        .map((deposit) => ({ member, deposit })),
    )
    .sort((a, b) =>
      a.deposit.maturityDate.localeCompare(b.deposit.maturityDate),
    )
  const assets = members
    .flatMap(({ member, otherAssets }) =>
      otherAssets.map((asset) => ({ member, asset })),
    )
    .sort((a, b) => b.asset.currentValue - a.asset.currentValue)
  const ipos = members.flatMap(({ member, ipos }) =>
    ipos
      .filter((ipo) => ipo.status === "applied" || ipo.status === "allotted")
      .map((ipo) => ({ member, ipo })),
  )

  const header = (
    <PageHeader
      title="FDs & other assets"
      description="Fixed deposits, gold, PPF, EPF, NPS, bonds, property and IPO applications across the family."
    />
  )

  if (deposits.length === 0 && assets.length === 0 && ipos.length === 0) {
    return (
      <>
        {header}
        <Card className="border-dashed">
          <CardContent className="grid justify-items-center gap-3 py-10 text-center">
            <PiggyBankIcon
              className="size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="font-medium">Nothing here yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Open a member to add their FDs, other assets and IPO applications.
              FDs and other assets count in the family totals.
            </p>
            <Button asChild>
              <Link href="/members">Go to members</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  const depositValue = deposits.reduce((sum, row) => sum + row.deposit.value, 0)
  const depositPrincipal = deposits.reduce(
    (sum, row) => sum + row.deposit.principal,
    0,
  )
  const maturingSoon = deposits.filter(
    ({ deposit }) =>
      !deposit.matured && daysUntil(deposit.maturityDate, today) <= SOON_DAYS,
  )
  const assetValue = assets.reduce(
    (sum, row) => sum + row.asset.currentValue,
    0,
  )
  const assetInvested = assets.reduce((sum, row) => sum + row.asset.invested, 0)
  const blocked = ipos
    .filter(({ ipo }) => ipo.status === "applied")
    .reduce((sum, { ipo }) => sum + ipo.shares_applied * Number(ipo.price), 0)

  return (
    <>
      {header}

      <div className="grid gap-2 sm:grid-cols-3">
        <StatTile
          label="Fixed deposits today"
          value={formatINR(depositValue, 0)}
          delta={
            deposits.length > 0
              ? `${formatSignedINR(depositValue - depositPrincipal, 0)} interest so far`
              : undefined
          }
          tone={toneOf(depositValue - depositPrincipal)}
          hint={
            maturingSoon.length > 0
              ? `${maturingSoon.length} maturing in the next ${SOON_DAYS} days`
              : `${deposits.length} running`
          }
        />
        <StatTile
          label="Gold, PPF & other"
          value={formatINR(assetValue, 0)}
          delta={
            assets.length > 0
              ? `${formatSignedINR(assetValue - assetInvested, 0)} on invested`
              : undefined
          }
          tone={toneOf(assetValue - assetInvested)}
          hint="At the values last entered"
        />
        <StatTile
          label="In IPO bids"
          value={formatINR(blocked, 0)}
          hint="Money blocked for applications not yet allotted; not in totals"
        />
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fixed deposits</CardTitle>
            <CardDescription>
              Running FDs, soonest maturity first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deposits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No running FDs.</p>
            ) : (
              <ul className="divide-y">
                {deposits.map(({ member, deposit }) => {
                  const days = daysUntil(deposit.maturityDate, today)
                  return (
                    <li
                      key={deposit.id}
                      className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm first:pt-0 last:pb-0"
                    >
                      <div className="grid min-w-0 gap-0.5">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {deposit.bank}
                          {deposit.matured ? (
                            <Badge variant="outline">Matured</Badge>
                          ) : (
                            days <= SOON_DAYS && (
                              <Badge variant="secondary">
                                {days === 0
                                  ? "Matures today"
                                  : `In ${days} days`}
                              </Badge>
                            )
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <MemberTag member={member} /> ·{" "}
                          {formatINR(deposit.principal, 0)} at {deposit.ratePct}
                          % · {FD_INTEREST_LABELS[deposit.interest]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {deposit.matured ? "Matured" : "Matures"}{" "}
                          {formatDate(deposit.maturityDate)} ·{" "}
                          {formatINR(deposit.maturityValue, 0)}
                        </p>
                      </div>
                      <p className="ml-auto font-medium tabular-nums">
                        {formatINR(deposit.value, 0)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gold, PPF &amp; other</CardTitle>
            <CardDescription>
              Values as last entered; update them from a member&apos;s page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="divide-y">
                {assets.map(({ member, asset }) => {
                  const gain = asset.currentValue - asset.invested
                  return (
                    <li
                      key={asset.id}
                      className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm first:pt-0 last:pb-0"
                    >
                      <div className="grid min-w-0 gap-0.5">
                        <p className="font-medium">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          <MemberTag member={member} /> ·{" "}
                          {OTHER_ASSET_LABELS[asset.kind]} · valued{" "}
                          {formatDate(asset.valueAsOf)}
                        </p>
                      </div>
                      <div className="ml-auto text-right tabular-nums">
                        <p className="font-medium">
                          {formatINR(asset.currentValue, 0)}
                        </p>
                        <p
                          className={cn("text-xs", toneTextClass(toneOf(gain)))}
                        >
                          {formatSignedINR(gain, 0)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {ipos.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>IPO applications</CardTitle>
              <CardDescription>
                Waiting for allotment, or allotted and not yet added as stock.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {ipos.map(({ member, ipo }) => (
                  <li
                    key={ipo.id}
                    className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm first:pt-0 last:pb-0"
                  >
                    <div className="grid min-w-0 gap-0.5">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {ipo.company}
                        <Badge variant="outline">
                          {IPO_STATUS_LABELS[ipo.status]}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <MemberTag member={member} /> · applied{" "}
                        {formatDate(ipo.applied_on)}
                        {ipo.status === "allotted" &&
                          ` · ${ipo.shares_allotted} allotted`}
                      </p>
                    </div>
                    <p className="ml-auto tabular-nums">
                      {formatINR(ipo.shares_applied * Number(ipo.price), 0)}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
