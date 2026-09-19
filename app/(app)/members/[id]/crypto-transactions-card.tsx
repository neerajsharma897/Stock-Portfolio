import { CryptoTransactionDialog } from "@/app/(app)/members/[id]/crypto-transaction-dialog"
import { DeleteCryptoTransactionButton } from "@/app/(app)/members/[id]/delete-crypto-transaction-button"
import type { StockAccount } from "@/app/(app)/members/[id]/transaction-dialog"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { CryptoTransactionWithCoin } from "@/lib/data/crypto"
import {
  formatDate,
  formatINR,
  formatPriceINR,
  formatQuantity,
} from "@/lib/format"
import { brokerAccountName } from "@/lib/members/options"
import { TRANSACTION_TYPE_LABELS } from "@/lib/transactions/options"

export function CryptoTransactionsCard({
  memberId,
  archived,
  accounts,
  transactions,
}: {
  memberId: string
  archived: boolean
  accounts: StockAccount[]
  transactions: CryptoTransactionWithCoin[]
}) {
  if (transactions.length === 0) return null
  const accountsById = new Map(accounts.map((account) => [account.id, account]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crypto entries</CardTitle>
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
                  Coin
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
                const summary = `${typeLabel.toLowerCase()} of ${formatQuantity(quantity)} ${transaction.coin.symbol} on ${formatDate(transaction.trade_date)}`

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
                    <td className="px-4 py-2.5">
                      <div className="font-medium">
                        {transaction.coin.symbol}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {transaction.coin.name}
                        {account && ` · ${brokerAccountName(account)}`}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatQuantity(quantity)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatPriceINR(price)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatINR(quantity * price)}
                      {charges > 0 && (
                        <div className="text-xs text-muted-foreground">
                          + {formatINR(charges)} fees
                        </div>
                      )}
                    </td>
                    {!archived && (
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <CryptoTransactionDialog
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
                              coin: {
                                market: transaction.coin.market,
                                symbol: transaction.coin.symbol,
                                name: transaction.coin.name,
                                last_price:
                                  transaction.coin.last_price === null
                                    ? null
                                    : Number(transaction.coin.last_price),
                                priced_at: transaction.coin.priced_at,
                              },
                            }}
                          />
                          <DeleteCryptoTransactionButton
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
