import { DeleteFundTransactionButton } from "@/app/(app)/members/[id]/delete-fund-transaction-button"
import { FundTransactionDialog } from "@/app/(app)/members/[id]/fund-transaction-dialog"
import type { StockAccount } from "@/app/(app)/members/[id]/transaction-dialog"
import { FundName } from "@/components/fund-name"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { FundTransactionWithScheme } from "@/lib/data/mutual-funds"
import { formatDate, formatINR, formatQuantity } from "@/lib/format"
import { brokerAccountName } from "@/lib/members/options"
import { MF_TRANSACTION_LABELS } from "@/lib/mutual-funds/options"

export function FundTransactionsCard({
  memberId,
  archived,
  accounts,
  transactions,
}: {
  memberId: string
  archived: boolean
  accounts: StockAccount[]
  transactions: FundTransactionWithScheme[]
}) {
  if (transactions.length === 0) return null
  const accountsById = new Map(accounts.map((account) => [account.id, account]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mutual fund entries</CardTitle>
        <CardDescription>
          {transactions.length}{" "}
          {transactions.length === 1 ? "entry" : "entries"}, newest first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative -mx-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">
                  Date
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Type
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Fund
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Units
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  NAV
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Amount
                </th>
                {!archived && (
                  <th scope="col" className="px-4 py-2">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((transaction) => {
                const units = Number(transaction.units)
                const nav = Number(transaction.nav)
                const charges = Number(transaction.charges)
                const account = accountsById.get(transaction.broker_account_id)
                const typeLabel = MF_TRANSACTION_LABELS[transaction.type]
                const summary = `${typeLabel.toLowerCase()} of ${formatQuantity(units)} units of ${transaction.scheme.name} on ${formatDate(transaction.trade_date)}`
                const detail = [
                  account && brokerAccountName(account),
                  transaction.folio_number &&
                    `Folio ${transaction.folio_number}`,
                ]
                  .filter(Boolean)
                  .join(" · ")

                return (
                  <tr key={transaction.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {formatDate(transaction.trade_date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={
                          transaction.type === "opening_balance"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {typeLabel}
                      </Badge>
                    </td>
                    <td className="max-w-80 px-4 py-2.5">
                      <FundName
                        scheme={transaction.scheme}
                        detail={detail || undefined}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatQuantity(units)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatINR(nav, 4)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatINR(units * nav)}
                      {charges > 0 && (
                        <div className="text-xs text-muted-foreground">
                          + {formatINR(charges)} charges
                        </div>
                      )}
                    </td>
                    {!archived && (
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <FundTransactionDialog
                            memberId={memberId}
                            accounts={accounts}
                            transaction={{
                              id: transaction.id,
                              type: transaction.type,
                              broker_account_id: transaction.broker_account_id,
                              folio_number: transaction.folio_number,
                              units,
                              nav,
                              charges,
                              trade_date: transaction.trade_date,
                              notes: transaction.notes,
                              fund: {
                                amfi_code: transaction.scheme.amfi_code,
                                name: transaction.scheme.name,
                                plan: transaction.scheme.plan,
                                option_type: transaction.scheme.option_type,
                                option_label: transaction.scheme.option_label,
                                nav:
                                  transaction.scheme.nav === null
                                    ? null
                                    : Number(transaction.scheme.nav),
                                nav_date: transaction.scheme.nav_date,
                              },
                            }}
                          />
                          <DeleteFundTransactionButton
                            transactionId={transaction.id}
                            summary={summary}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
