// Builds one position (a member's holding of one stock in one broker account)
// from its transactions, matching sells against the oldest shares first (FIFO).
//
// Amounts are plain JavaScript numbers. At family-portfolio scale the rounding
// error is far below a paisa, and values are rounded only when displayed.

import { formatDate } from "@/lib/format"

export type TransactionType = "opening_balance" | "buy" | "sell"

export type PositionTransaction = {
  id: string
  type: TransactionType
  quantity: number
  /** Price per share. For an opening balance, the average buy price. */
  price: number
  /** Brokerage, taxes and other charges for the whole trade. */
  charges: number
  /** Trade date, YYYY-MM-DD. */
  tradeDate: string
  /** When the entry was saved; orders trades within the same day. */
  createdAt: string
}

export type Lot = {
  transactionId: string
  date: string
  quantity: number
  /** Cost per share including the buy's charges. */
  costPerShare: number
}

/** One sell, matched against the oldest shares (FIFO). */
export type Sale = {
  transactionId: string
  date: string
  quantity: number
  /** Sell price per share. */
  price: number
  /** Charges on the sell. */
  charges: number
  /** Cost of the shares sold, including their buy charges. */
  costBasis: number
  /** Profit or loss on this sell, after all charges. */
  realizedPnl: number
}

export type Position = {
  quantity: number
  /** Cost of the shares still held, including buy charges. */
  invested: number
  /** invested / quantity, or 0 when nothing is held. */
  averageCost: number
  /** Profit or loss booked by sells, after all charges. */
  realizedPnl: number
  /** Shares still held, oldest first. */
  lots: Lot[]
  /** Every sell, oldest first, e.g. for tax on each sale. */
  sales: Sale[]
}

export type PositionResult =
  | { ok: true; position: Position }
  | { ok: false; transactionId: string; message: string }

const EPSILON = 1e-9

// Within a day: opening balance first, then buys, then sells, then by save time.
const TYPE_ORDER: Record<TransactionType, number> = {
  opening_balance: 0,
  buy: 1,
  sell: 2,
}

export function sortTransactions<T extends PositionTransaction>(
  transactions: readonly T[],
): T[] {
  return [...transactions].sort(
    (a, b) =>
      a.tradeDate.localeCompare(b.tradeDate) ||
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      a.createdAt.localeCompare(b.createdAt),
  )
}

function roundQuantity(value: number) {
  return Number(value.toFixed(8))
}

export function buildPosition(
  transactions: readonly PositionTransaction[],
  /** Word for a sell in error messages, e.g. "redemption" for mutual funds. */
  { sellLabel = "sell" }: { sellLabel?: string } = {},
): PositionResult {
  const lots: Lot[] = []
  const sales: Sale[] = []
  let realizedPnl = 0

  for (const transaction of sortTransactions(transactions)) {
    if (transaction.type !== "sell") {
      lots.push({
        transactionId: transaction.id,
        date: transaction.tradeDate,
        quantity: transaction.quantity,
        costPerShare:
          (transaction.quantity * transaction.price + transaction.charges) /
          transaction.quantity,
      })
      continue
    }

    const held = lots.reduce((sum, lot) => sum + lot.quantity, 0)
    if (transaction.quantity > held + EPSILON) {
      return {
        ok: false,
        transactionId: transaction.id,
        message: `The ${sellLabel} of ${roundQuantity(transaction.quantity)} on ${formatDate(transaction.tradeDate)} is more than the ${roundQuantity(held)} held on that date.`,
      }
    }

    let remaining = transaction.quantity
    let costBasis = 0
    while (remaining > EPSILON && lots.length > 0) {
      const lot = lots[0]
      const used = Math.min(lot.quantity, remaining)
      costBasis += used * lot.costPerShare
      lot.quantity -= used
      remaining -= used
      if (lot.quantity <= EPSILON) lots.shift()
    }

    const salePnl =
      transaction.quantity * transaction.price - transaction.charges - costBasis
    sales.push({
      transactionId: transaction.id,
      date: transaction.tradeDate,
      quantity: transaction.quantity,
      price: transaction.price,
      charges: transaction.charges,
      costBasis,
      realizedPnl: salePnl,
    })
    realizedPnl += salePnl
  }

  const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0)
  const invested = lots.reduce(
    (sum, lot) => sum + lot.quantity * lot.costPerShare,
    0,
  )

  return {
    ok: true,
    position: {
      quantity: roundQuantity(quantity),
      invested,
      averageCost: quantity > EPSILON ? invested / quantity : 0,
      realizedPnl,
      lots,
      sales,
    },
  }
}
