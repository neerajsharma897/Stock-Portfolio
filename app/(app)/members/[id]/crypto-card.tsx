import { TriangleAlertIcon } from "lucide-react"

import { CryptoTransactionDialog } from "@/app/(app)/members/[id]/crypto-transaction-dialog"
import type { StockAccount } from "@/app/(app)/members/[id]/transaction-dialog"
import { toneOf, toneTextClass } from "@/components/stat-tile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { CryptoProblem, ValuedCrypto } from "@/lib/crypto/portfolio"
import type { Coin } from "@/lib/data/crypto"
import {
  formatINR,
  formatPercent,
  formatPriceINR,
  formatQuantity,
  formatSignedINR,
} from "@/lib/format"
import { brokerAccountName } from "@/lib/members/options"
import { cn } from "@/lib/utils"

function NoPrice() {
  return (
    <span className="text-muted-foreground">
      —<span className="sr-only">no price yet</span>
    </span>
  )
}

export function CryptoCard({
  memberId,
  memberName,
  archived,
  accounts,
  holdings,
  problems,
  coins,
}: {
  memberId: string
  memberName: string
  archived: boolean
  accounts: StockAccount[]
  holdings: ValuedCrypto[]
  problems: CryptoProblem[]
  coins: Map<string, Coin>
}) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const symbolOf = (holding: { market: string }) =>
    coins.get(holding.market)?.symbol ?? holding.market

  const current = holdings
    .filter((holding) => holding.position.quantity > 0)
    .sort(
      (a, b) =>
        (b.currentValue ?? 0) - (a.currentValue ?? 0) ||
        symbolOf(a).localeCompare(symbolOf(b)),
    )
  const invested = current.reduce((sum, h) => sum + h.position.invested, 0)
  const realized = holdings.reduce((sum, h) => sum + h.position.realizedPnl, 0)
  const hasBookedPnl = holdings.some((h) => h.position.realizedPnl !== 0)
  const canAdd = !archived && accounts.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crypto</CardTitle>
        <CardDescription>
          {current.length === 0
            ? "No coins held yet."
            : `${current.length} ${current.length === 1 ? "coin" : "coins"} · ${formatINR(invested)} invested`}
        </CardDescription>
        {canAdd && (
          <CardAction>
            <CryptoTransactionDialog memberId={memberId} accounts={accounts} />
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
              <p className="font-medium">
                Some crypto entries don&apos;t add up
              </p>
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
            Add a CoinDCX account under Accounts before entering crypto.
          </p>
        ) : current.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {archived
              ? "No coins."
              : `Add an opening balance for each coin ${memberName} already holds, using the quantity and average buy price from CoinDCX.`}
          </p>
        ) : (
          <div className="relative -mx-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">
                    Coin
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
                  const coin = coins.get(holding.market)
                  const account = accountsById.get(holding.brokerAccountId)
                  const pnlTone = toneTextClass(toneOf(holding.unrealizedPnl))

                  return (
                    <tr key={`${holding.brokerAccountId}:${holding.market}`}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{symbolOf(holding)}</div>
                        <div className="text-xs text-muted-foreground">
                          {coin?.name}
                          {account && ` · ${brokerAccountName(account)}`}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatQuantity(holding.position.quantity)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatPriceINR(holding.position.averageCost)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {holding.price ? (
                          <>
                            <div>{formatPriceINR(holding.price.lastPrice)}</div>
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
            Booked from sells, after fees:{" "}
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
