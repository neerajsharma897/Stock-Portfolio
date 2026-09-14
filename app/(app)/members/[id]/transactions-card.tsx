import { DeleteTransactionButton } from "@/app/(app)/members/[id]/delete-transaction-button"
import {
  TransactionDialog,
  type StockAccount,
} from "@/app/(app)/members/[id]/transaction-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { TransactionWithInstrument } from "@/lib/data/transactions"
import { formatDate, formatINR, formatQuantity } from "@/lib/format"
import { brokerAccountName } from "@/lib/members/options"
import { TRANSACTION_TYPE_LABELS } from "@/lib/transactions/options"

const TYPE_BADGE = {
  opening_balance: "secondary",
  buy: "outline",
  sell: "outline",
} as const

export function TransactionsCard({
  memberId,
  archived,
  accounts,
  transactions,
}: {
  memberId: string
  archived: boolean
  accounts: StockAccount[]
  transactions: TransactionWithInstrument[]
}) {
  if (transactions.length === 0) return null
  const accountsById = new Map(accounts.map((account) => [account.id, account]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardDescription>
          {transactions.length}{" "}
          {transactions.length === 1 ? "entry" : "entries"}, newest first.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">
                  Date
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Type
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Stock
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Quantity
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Price
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
                const quantity = Number(transaction.quantity)
                const price = Number(transaction.price)
                const charges = Number(transaction.charges)
                const account = accountsById.get(transaction.broker_account_id)
                const typeLabel = TRANSACTION_TYPE_LABELS[transaction.type]
                const summary = `${typeLabel.toLowerCase()} of ${formatQuantity(quantity)} ${transaction.instrument.symbol} on ${formatDate(transaction.trade_date)}`

                return (
                  <tr key={transaction.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {formatDate(transaction.trade_date)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={TYPE_BADGE[transaction.type]}>
                        {typeLabel}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">
                        {transaction.instrument.symbol}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.instrument.exchange}
                        {account && ` · ${brokerAccountName(account)}`}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatQuantity(quantity)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatINR(price)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatINR(quantity * price)}
                      {charges > 0 && (
                        <div className="text-xs text-muted-foreground">
                          + {formatINR(charges)} charges
                        </div>
                      )}
                    </td>
                    {!archived && (
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <TransactionDialog
                            memberId={memberId}
                            accounts={accounts}
                            transaction={{
                              id: transaction.id,
                              type: transaction.type,
                              broker_account_id: transaction.broker_account_id,
                              quantity,
                              price,
                              charges,
                              trade_date: transaction.trade_date,
                              notes: transaction.notes,
                              instrument: {
                                id: transaction.instrument.id,
                                symbol: transaction.instrument.symbol,
                                exchange: transaction.instrument.exchange,
                                kind: transaction.instrument.kind,
                              },
                            }}
                          />
                          <DeleteTransactionButton
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
