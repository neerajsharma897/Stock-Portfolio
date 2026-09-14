import type { TransactionType } from "@/lib/portfolio/holdings"

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  opening_balance: "Opening balance",
  buy: "Buy",
  sell: "Sell",
}

export const TRANSACTION_TYPES = Object.keys(TRANSACTION_TYPE_LABELS) as [
  TransactionType,
  ...TransactionType[],
]
