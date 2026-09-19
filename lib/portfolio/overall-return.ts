// One XIRR across everything a member (or the family) holds that has dated cash
// flows: stocks, mutual funds, crypto and fixed deposits. Gold, PPF and other
// hand-valued assets have no purchase dates, so they're left out.

import {
  depositValueOn,
  type ValuedDeposit,
} from "@/lib/other-assets/portfolio"
import { combinedAnnualReturn, type ReturnPart } from "@/lib/portfolio/returns"
import type { CashFlow } from "@/lib/portfolio/xirr"

type Valued = {
  flows: readonly CashFlow[]
  position: { quantity: number }
  currentValue: number | null
  price: { pricedAt: string } | null
}

function holdingPart(holding: Valued): ReturnPart {
  return {
    flows: holding.flows,
    held: holding.position.quantity > 0,
    currentValue: holding.currentValue,
    valuedOn: holding.price?.pricedAt ?? null,
  }
}

/** An FD as money in on its start date, and out when it closed (or its value today). */
export function depositPart(deposit: ValuedDeposit, today: string): ReturnPart {
  const flows: CashFlow[] = [
    { date: deposit.startDate, amount: -deposit.principal },
  ]
  if (deposit.closed && deposit.closedOn) {
    flows.push({
      date: deposit.closedOn,
      amount: depositValueOn(deposit, deposit.closedOn),
    })
  }
  return {
    flows,
    held: !deposit.closed,
    currentValue: deposit.value,
    valuedOn: today,
  }
}

/** Null under a year, or while any held stock, fund or coin has no price. */
export function overallReturn(
  {
    holdings,
    funds,
    crypto,
    deposits,
  }: {
    holdings: readonly Valued[]
    funds: readonly Valued[]
    crypto: readonly Valued[]
    deposits: readonly ValuedDeposit[]
  },
  today: string,
): number | null {
  return combinedAnnualReturn([
    ...holdings.map(holdingPart),
    ...funds.map(holdingPart),
    ...crypto.map(holdingPart),
    ...deposits.map((deposit) => depositPart(deposit, today)),
  ])
}
