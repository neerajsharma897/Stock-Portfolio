import { TriangleAlertIcon } from "lucide-react"
import Link from "next/link"

import {
  TransactionDialog,
  type StockAccount,
} from "@/app/(app)/members/[id]/transaction-dialog"
import { toneOf, toneTextClass } from "@/components/stat-tile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UpdatePricesDialog } from "@/components/update-prices-dialog"
import type { TransactionInstrument } from "@/lib/data/transactions"
import {
  formatINR,
  formatPercent,
  formatQuantity,
  formatSignedINR,
} from "@/lib/format"
import { brokerAccountName } from "@/lib/members/options"
import type { HoldingProblem } from "@/lib/portfolio/member-holdings"
import type { PriceItem, ValuedHolding } from "@/lib/portfolio/valuation"
import { cn } from "@/lib/utils"

function NoPrice() {
  return (
    <span className="text-muted-foreground">
      —<span className="sr-only">no price yet</span>
    </span>
  )
}

export function HoldingsCard({
  memberId,
  memberName,
  archived,
  accounts,
  holdings,
  problems,
  instruments,
  priceItems,
}: {
  memberId: string
  memberName: string
  archived: boolean
  accounts: StockAccount[]
  holdings: ValuedHolding[]
  problems: HoldingProblem[]
  instruments: Map<number, TransactionInstrument>
  priceItems: PriceItem[]
}) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const symbolOf = (holding: { instrumentId: number }) =>
    instruments.get(holding.instrumentId)?.symbol ?? "Unknown"

  const current = holdings
    .filter((holding) => holding.position.quantity > 0)
    .sort((a, b) => symbolOf(a).localeCompare(symbolOf(b)))
  const invested = current.reduce((sum, h) => sum + h.position.invested, 0)
  const realized = holdings.reduce((sum, h) => sum + h.position.realizedPnl, 0)
  const hasBookedPnl = holdings.some((h) => h.position.realizedPnl !== 0)
  const canAdd = !archived && accounts.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stocks</CardTitle>
        <CardDescription>
          {current.length === 0
            ? "No shares held yet."
            : `${current.length} ${current.length === 1 ? "holding" : "holdings"} · ${formatINR(invested)} invested`}
        </CardDescription>
        {(canAdd || priceItems.length > 0) && (
          <CardAction className="flex flex-wrap justify-end gap-2">
            <UpdatePricesDialog items={priceItems} />
            {canAdd && (
              <TransactionDialog memberId={memberId} accounts={accounts} />
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="grid gap-4">
        {problems.length > 0 && (
          <div
            role="alert"
            className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
          >
            <TriangleAlertIcon
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden
            />
            <div className="grid gap-1">
              <p className="font-medium">Some entries don&apos;t add up</p>
              {problems.map((problem) => (
                <p
                  key={problem.transactionId}
                  className="text-muted-foreground"
                >
                  {symbolOf(problem)}: {problem.message}
                </p>
              ))}
            </div>
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a stock broker account below before entering holdings.
          </p>
        ) : current.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {archived
              ? "No holdings."
              : `Add an opening balance for each stock ${memberName} already holds, using the quantity and average price from the broker app.`}
          </p>
        ) : (
          <div className="relative -mx-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Stock
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Quantity
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Avg cost
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Last price
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Current value
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    P&amp;L
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {current.map((holding) => {
                  const instrument = instruments.get(holding.instrumentId)
                  const account = accountsById.get(holding.brokerAccountId)
                  const pnlTone = toneTextClass(toneOf(holding.unrealizedPnl))

                  return (
                    <tr
                      key={`${holding.brokerAccountId}:${holding.instrumentId}`}
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/news?stock=${holding.instrumentId}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {symbolOf(holding)}
                          <span className="sr-only"> news</span>
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {instrument?.exchange}
                          {instrument?.kind === "sgb" && " · Gold bond"}
                          {account && ` · ${brokerAccountName(account)}`}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatQuantity(holding.position.quantity)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatINR(holding.position.averageCost)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {holding.price ? (
                          <>
                            <div>{formatINR(holding.price.lastPrice)}</div>
                            {holding.dayChangePct !== null && (
                              <div
                                className={cn(
                                  "text-xs",
                                  toneTextClass(toneOf(holding.dayChange)),
                                )}
                              >
                                {formatPercent(holding.dayChangePct)}
                                <span className="sr-only"> today</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <NoPrice />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {holding.currentValue !== null ? (
                          formatINR(holding.currentValue)
                        ) : (
                          <NoPrice />
                        )}
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
                            {holding.xirr !== null && (
                              <div className="text-xs text-muted-foreground">
                                {formatPercent(holding.xirr * 100)} XIRR
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
        )}

        {hasBookedPnl && (
          <p className="text-sm text-muted-foreground">
            Booked from sells, after charges:{" "}
            <span
              className={cn(
                "font-medium tabular-nums",
                toneTextClass(toneOf(realized)),
              )}
            >
              {formatSignedINR(realized)}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
