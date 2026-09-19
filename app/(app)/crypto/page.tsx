import { CoinsIcon, TriangleAlertIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { LiveCryptoPrices } from "@/components/live-crypto-prices"
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
import { estimateCryptoTax, financialYearOf } from "@/lib/crypto/tax"
import { getFamilyPortfolio } from "@/lib/data/portfolio"
import { todayInIndia } from "@/lib/dates"
import {
  formatINR,
  formatPercent,
  formatPriceINR,
  formatQuantity,
  formatSignedINR,
} from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Crypto" }

export default async function CryptoPage() {
  const { members, cryptoSummary, coins } = await getFamilyPortfolio()

  const rows = members
    .flatMap(({ member, crypto }) =>
      crypto
        .filter((holding) => holding.position.quantity > 0)
        .map((holding) => ({
          member,
          holding,
          coin: coins.get(holding.market),
        })),
    )
    .sort(
      (a, b) => (b.holding.currentValue ?? 0) - (a.holding.currentValue ?? 0),
    )
  const membersWithProblems = members.filter(
    (portfolio) => portfolio.cryptoProblems.length > 0,
  )
  const tax = estimateCryptoTax(
    members.flatMap((portfolio) => portfolio.crypto),
    financialYearOf(todayInIndia()),
  )

  const header = (live: boolean) => (
    <PageHeader
      title="Crypto"
      description="Every family member's coins, valued at CoinDCX's latest rupee price."
    >
      {live && (
        <LiveCryptoPrices initialPricedAt={cryptoSummary.latestPricedAt} />
      )}
    </PageHeader>
  )

  if (rows.length === 0 && cryptoSummary.realizedPnl === 0) {
    return (
      <>
        {header(false)}
        <Card className="border-dashed">
          <CardContent className="grid justify-items-center gap-3 py-10 text-center">
            <CoinsIcon className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">No crypto yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Download the coin list in Settings, add a CoinDCX account to the
              member, then add an opening balance for each coin they hold.
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

  const valued = cryptoSummary.pricedCount > 0
  const unpriced = cryptoSummary.holdingCount - cryptoSummary.pricedCount

  return (
    <>
      {header(rows.length > 0)}

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
            Some crypto entries don&apos;t add up for{" "}
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
            . Those coins are left out of the totals until fixed.
          </p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          hero
          className="sm:col-span-2"
          label="Current value"
          value={valued ? formatINR(cryptoSummary.currentValue, 0) : "—"}
          delta={
            valued && cryptoSummary.dayChangePct !== null
              ? `${formatSignedINR(cryptoSummary.dayChange, 0)} (${formatPercent(cryptoSummary.dayChangePct)}) in 24 hours`
              : undefined
          }
          tone={toneOf(cryptoSummary.dayChange)}
          hint={
            !valued
              ? "No prices yet. Update the coin list in Settings."
              : unpriced > 0
                ? `${unpriced} of ${cryptoSummary.holdingCount} coins have no price yet and aren't included.`
                : "Prices refresh every 30 seconds while this page is open."
          }
        />
        <StatTile
          label="Invested"
          value={formatINR(cryptoSummary.invested, 0)}
          hint={`${cryptoSummary.holdingCount} ${cryptoSummary.holdingCount === 1 ? "holding" : "holdings"}, including fees`}
        />
        <StatTile
          label="Unrealised P&L"
          value={valued ? formatSignedINR(cryptoSummary.unrealizedPnl, 0) : "—"}
          delta={
            valued && cryptoSummary.unrealizedPct !== null
              ? `${formatPercent(cryptoSummary.unrealizedPct)} on invested`
              : undefined
          }
          tone={toneOf(cryptoSummary.unrealizedPnl)}
        />
        <StatTile
          label="Booked from sells"
          value={formatSignedINR(cryptoSummary.realizedPnl, 0)}
          hint="After fees"
        />
      </div>

      <div className="mt-2 grid gap-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All coins</CardTitle>
            <CardDescription>
              {rows.length} {rows.length === 1 ? "holding" : "holdings"},
              largest first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No coins held right now.
              </p>
            ) : (
              <div className="-mx-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="px-4 py-2 font-medium">
                        Member
                      </th>
                      <th scope="col" className="px-4 py-2 font-medium">
                        Coin
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
                    {rows.map(({ member, holding, coin }) => {
                      const pnlTone = toneTextClass(
                        toneOf(holding.unrealizedPnl),
                      )
                      return (
                        <tr
                          key={`${member.id}:${holding.brokerAccountId}:${holding.market}`}
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
                          <td className="px-4 py-2.5">
                            <div className="font-medium">
                              {coin?.symbol ?? holding.market}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatQuantity(holding.position.quantity)}{" "}
                              {coin?.name}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {holding.price
                              ? formatPriceINR(holding.price.lastPrice)
                              : "—"}
                            {holding.dayChangePct !== null && (
                              <div
                                className={cn(
                                  "text-xs",
                                  toneTextClass(toneOf(holding.dayChange)),
                                )}
                              >
                                {formatPercent(holding.dayChangePct)}
                                <span className="sr-only"> in 24 hours</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {holding.currentValue !== null
                              ? formatINR(holding.currentValue)
                              : "—"}
                            <div className="text-xs text-muted-foreground">
                              {formatINR(holding.position.invested)} invested
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {holding.unrealizedPnl !== null ? (
                              <>
                                <div className={cn("font-medium", pnlTone)}>
                                  {formatSignedINR(holding.unrealizedPnl)}
                                </div>
                                {holding.unrealizedPct !== null && (
                                  <div className={cn("text-xs", pnlTone)}>
                                    {formatPercent(holding.unrealizedPct)}
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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax estimate, {tax.year.label}</CardTitle>
            <CardDescription>
              Crypto gains are taxed at a flat 30% plus 4% cess. Losses
              can&apos;t be set off, and 1% TDS is deducted when selling.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {tax.saleCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sells yet this financial year, so no tax on crypto gains so
                far.
              </p>
            ) : (
              <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
                <dt className="text-muted-foreground">
                  {tax.saleCount} {tax.saleCount === 1 ? "sell" : "sells"}
                </dt>
                <dd className="text-right tabular-nums">
                  {formatINR(tax.saleValue, 0)}
                </dd>
                <dt className="text-muted-foreground">Gains</dt>
                <dd className="text-right tabular-nums">
                  {formatINR(tax.gains, 0)}
                </dd>
                <dt className="text-muted-foreground">
                  Losses (not deductible)
                </dt>
                <dd className="text-right tabular-nums">
                  {formatINR(tax.losses, 0)}
                </dd>
                <dt className="font-medium">Estimated tax</dt>
                <dd className="text-right font-medium tabular-nums">
                  {formatINR(tax.tax, 0)}
                </dd>
                <dt className="text-muted-foreground">TDS at 1%</dt>
                <dd className="text-right tabular-nums">
                  {formatINR(tax.tds, 0)}
                </dd>
              </dl>
            )}
            <p className="text-xs text-muted-foreground">
              Worked out from the entries in this app: each sell&apos;s gain is
              its sale value minus the buy cost of the coins sold, oldest first.
              TDS already deducted counts towards the tax. A guide for planning,
              not tax advice.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
