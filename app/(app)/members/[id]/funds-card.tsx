import { TriangleAlertIcon } from "lucide-react"

import { FundTransactionDialog } from "@/app/(app)/members/[id]/fund-transaction-dialog"
import type { StockAccount } from "@/app/(app)/members/[id]/transaction-dialog"
import { FundName } from "@/components/fund-name"
import { toneOf, toneTextClass } from "@/components/stat-tile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { FundScheme } from "@/lib/data/mutual-funds"
import {
  formatDate,
  formatINR,
  formatPercent,
  formatQuantity,
  formatSignedINR,
} from "@/lib/format"
import { brokerAccountName } from "@/lib/members/options"
import type { FundProblem, ValuedFund } from "@/lib/mutual-funds/portfolio"
import { cn } from "@/lib/utils"

function NoNav() {
  return (
    <span className="text-muted-foreground">
      —<span className="sr-only">no NAV yet</span>
    </span>
  )
}

export function FundsCard({
  memberId,
  memberName,
  archived,
  accounts,
  funds,
  problems,
  schemes,
  xirr,
}: {
  memberId: string
  memberName: string
  archived: boolean
  accounts: StockAccount[]
  funds: ValuedFund[]
  problems: FundProblem[]
  schemes: Map<number, FundScheme>
  xirr: number | null
}) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const nameOf = (fund: { amfiCode: number }) =>
    schemes.get(fund.amfiCode)?.name ?? "Unknown fund"

  const current = funds
    .filter((fund) => fund.position.quantity > 0)
    .sort(
      (a, b) =>
        (b.currentValue ?? 0) - (a.currentValue ?? 0) ||
        nameOf(a).localeCompare(nameOf(b)),
    )
  const invested = current.reduce((sum, f) => sum + f.position.invested, 0)
  const realized = funds.reduce((sum, f) => sum + f.position.realizedPnl, 0)
  const hasBookedPnl = funds.some((f) => f.position.realizedPnl !== 0)
  const canAdd = !archived && accounts.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mutual funds</CardTitle>
        <CardDescription>
          {current.length === 0
            ? "No funds held yet."
            : `${current.length} ${current.length === 1 ? "fund" : "funds"} · ${formatINR(invested)} invested${xirr !== null ? ` · ${formatPercent(xirr * 100)} XIRR` : ""}`}
        </CardDescription>
        {canAdd && (
          <CardAction>
            <FundTransactionDialog memberId={memberId} accounts={accounts} />
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
              <p className="font-medium">Some fund entries don&apos;t add up</p>
              {problems.map((problem) => (
                <p
                  key={problem.transactionId}
                  className="text-muted-foreground"
                >
                  {nameOf(problem)}: {problem.message}
                </p>
              ))}
            </div>
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add the platform the funds are held on (e.g. Groww or Zerodha) under
            Accounts before entering funds.
          </p>
        ) : current.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {archived
              ? "No funds."
              : `Add an opening balance for each fund ${memberName} already holds, using the units and invested amount from the platform or statement.`}
          </p>
        ) : (
          <div className="relative -mx-4 overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Fund
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Units
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Avg cost
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Latest NAV
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
                {current.map((fund) => {
                  const account = accountsById.get(fund.brokerAccountId)
                  const pnlTone = toneTextClass(toneOf(fund.unrealizedPnl))

                  return (
                    <tr key={`${fund.brokerAccountId}:${fund.amfiCode}`}>
                      <td className="max-w-80 px-4 py-2.5">
                        <FundName
                          scheme={schemes.get(fund.amfiCode)}
                          detail={account && brokerAccountName(account)}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatQuantity(fund.position.quantity)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatINR(fund.position.averageCost, 4)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fund.price ? (
                          <>
                            <div>{formatINR(fund.price.lastPrice, 4)}</div>
                            <div className="text-xs text-muted-foreground">
                              {fund.dayChangePct !== null && (
                                <span
                                  className={toneTextClass(
                                    toneOf(fund.dayChange),
                                  )}
                                >
                                  {formatPercent(fund.dayChangePct)}{" "}
                                </span>
                              )}
                              <span className="sr-only">on </span>
                              {formatDate(fund.price.pricedAt)}
                            </div>
                          </>
                        ) : (
                          <NoNav />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {fund.currentValue !== null ? (
                          formatINR(fund.currentValue)
                        ) : (
                          <NoNav />
                        )}
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
                          <NoNav />
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
            Booked from redemptions, after charges:{" "}
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
