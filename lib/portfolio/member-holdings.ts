import {
  buildPosition,
  type CorporateAction,
  type Position,
  type PositionTransaction,
} from "@/lib/portfolio/holdings"
import { cashFlowsOf } from "@/lib/portfolio/returns"
import type { CashFlow } from "@/lib/portfolio/xirr"

export type TransactionForHolding = PositionTransaction & {
  brokerAccountId: string
  instrumentId: number
}

export type Holding = {
  brokerAccountId: string
  instrumentId: number
  position: Position
  /** Money put in (negative) and taken out (positive), one per entry. */
  flows: CashFlow[]
}

/** A position whose saved entries don't add up, e.g. a sell larger than the shares held. */
export type HoldingProblem = {
  brokerAccountId: string
  instrumentId: number
  transactionId: string
  message: string
}

/**
 * Groups a member's transactions into one position per broker account and
 * stock, applying each stock's splits and bonuses.
 */
export function groupHoldings(
  transactions: readonly TransactionForHolding[],
  actionsByInstrument: ReadonlyMap<
    number,
    readonly CorporateAction[]
  > = new Map(),
): {
  holdings: Holding[]
  problems: HoldingProblem[]
} {
  const groups = new Map<string, TransactionForHolding[]>()
  for (const transaction of transactions) {
    const key = `${transaction.brokerAccountId}:${transaction.instrumentId}`
    const group = groups.get(key)
    if (group) group.push(transaction)
    else groups.set(key, [transaction])
  }

  const holdings: Holding[] = []
  const problems: HoldingProblem[] = []
  for (const group of groups.values()) {
    const { brokerAccountId, instrumentId } = group[0]
    const result = buildPosition(group, {
      actions: actionsByInstrument.get(instrumentId),
    })
    if (result.ok) {
      holdings.push({
        brokerAccountId,
        instrumentId,
        position: result.position,
        flows: cashFlowsOf(group),
      })
    } else {
      problems.push({
        brokerAccountId,
        instrumentId,
        transactionId: result.transactionId,
        message: result.message,
      })
    }
  }
  return { holdings, problems }
}
