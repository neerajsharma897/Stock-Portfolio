// Builds one position (a member's holding of one stock in one broker account)
// from its transactions, matching sells against the oldest shares first (FIFO).
// Stock splits and bonus issues adjust the shares held on their ex-date.
//
// Amounts are plain JavaScript numbers. At family-portfolio scale the rounding
// error is far below a paisa, and values are rounded only when displayed.

import { todayInIndia } from "@/lib/dates"
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
  /** When the shares were acquired (the ex-date for bonus shares). */
  date: string
  quantity: number
  /** Cost per share including the buy's charges. */
  costPerShare: number
  /** Opening balances have an approximate date and cost. */
  source: "opening_balance" | "buy" | "bonus"
}

/** The part of a lot a sell used. */
export type MatchedLot = {
  date: string
  quantity: number
  /** Cost of these shares, including their buy charges. */
  cost: number
  source: Lot["source"]
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
  /** The lots it used, oldest first, e.g. for short- and long-term gains. */
  matched: MatchedLot[]
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

/** A stock split or bonus issue. */
export type CorporateAction = {
  id: string
  kind: "split" | "bonus"
  /** YYYY-MM-DD. Shares held at the start of this day are adjusted. */
  exDate: string
  /** Split: `ratioFrom` old shares become `ratioTo`. Bonus: `ratioTo` new shares for every `ratioFrom` held. */
  ratioFrom: number
  ratioTo: number
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

/**
 * A split changes the count and price of every lot but not what was paid. A
 * bonus adds a free lot dated the ex-date, which is how it's taxed; fractional
 * bonus entitlements are paid in cash, so only whole shares are added.
 */
function applyCorporateAction(lots: Lot[], action: CorporateAction) {
  if (action.kind === "split") {
    const factor = action.ratioTo / action.ratioFrom
    for (const lot of lots) {
      lot.quantity *= factor
      lot.costPerShare /= factor
    }
    return
  }
  const held = lots.reduce((sum, lot) => sum + lot.quantity, 0)
  const bonus = Math.floor((held * action.ratioTo) / action.ratioFrom + EPSILON)
  if (bonus > 0) {
    lots.push({
      transactionId: action.id,
      date: action.exDate,
      quantity: bonus,
      costPerShare: 0,
      source: "bonus",
    })
  }
}

export function buildPosition(
  transactions: readonly PositionTransaction[],
  {
    sellLabel = "sell",
    actions = [],
    asOf = todayInIndia(),
  }: {
    /** Word for a sell in error messages, e.g. "redemption" for mutual funds. */
    sellLabel?: string
    /** Splits and bonuses of this stock, applied on their ex-date. */
    actions?: readonly CorporateAction[]
    /** Actions with a later ex-date haven't happened yet (YYYY-MM-DD). */
    asOf?: string
  } = {},
): PositionResult {
  const lots: Lot[] = []
  const sales: Sale[] = []
  let realizedPnl = 0

  const pending = [...actions].sort((a, b) => a.exDate.localeCompare(b.exDate))
  let nextAction = 0
  const applyActionsUpTo = (date: string) => {
    while (nextAction < pending.length && pending[nextAction].exDate <= date) {
      applyCorporateAction(lots, pending[nextAction])
      nextAction += 1
    }
  }

  for (const transaction of sortTransactions(transactions)) {
    applyActionsUpTo(transaction.tradeDate)
    if (transaction.type !== "sell") {
      lots.push({
        transactionId: transaction.id,
        date: transaction.tradeDate,
        quantity: transaction.quantity,
        costPerShare:
          (transaction.quantity * transaction.price + transaction.charges) /
          transaction.quantity,
        source:
          transaction.type === "opening_balance" ? "opening_balance" : "buy",
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
    const matched: MatchedLot[] = []
    while (remaining > EPSILON && lots.length > 0) {
      const lot = lots[0]
      const used = Math.min(lot.quantity, remaining)
      costBasis += used * lot.costPerShare
      matched.push({
        date: lot.date,
        quantity: used,
        cost: used * lot.costPerShare,
        source: lot.source,
      })
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
      matched,
    })
    realizedPnl += salePnl
  }

  applyActionsUpTo(asOf)

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
