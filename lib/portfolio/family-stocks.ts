// The family's stocks combined per stock: every member and broker account
// holding the same stock becomes one row, with who holds how much.

import { combinedAnnualReturn, type ReturnPart } from "@/lib/portfolio/returns"
import type { Price, ValuedHolding } from "@/lib/portfolio/valuation"

export type StockHolder = {
  memberId: string
  quantity: number
  currentValue: number | null
}

export type FamilyStock = {
  instrumentId: number
  quantity: number
  invested: number
  averageCost: number
  price: Price | null
  currentValue: number | null
  unrealizedPnl: number | null
  unrealizedPct: number | null
  dayChange: number | null
  dayChangePct: number | null
  /** Yearly return of every holder's entries together; null under a year or without a price. */
  xirr: number | null
  /** Share of the priced stock value, in percent; null without a price. */
  weightPct: number | null
  /** Largest holding first. */
  holders: StockHolder[]
}

type MemberHoldings = {
  member: { id: string }
  holdings: readonly ValuedHolding[]
}

/** Open stock positions across the family, one per stock, largest value first. */
export function familyStocks(
  members: readonly MemberHoldings[],
): FamilyStock[] {
  const groups = new Map<
    number,
    { memberId: string; holding: ValuedHolding }[]
  >()
  for (const { member, holdings } of members) {
    for (const holding of holdings) {
      if (holding.position.quantity <= 0) continue
      const group = groups.get(holding.instrumentId) ?? []
      group.push({ memberId: member.id, holding })
      groups.set(holding.instrumentId, group)
    }
  }

  const stocks = [...groups.entries()].map(([instrumentId, group]) => {
    const holdings = group.map((entry) => entry.holding)
    // Every holding of a stock shares its price.
    const price = holdings[0].price
    const quantity = sum(holdings.map((h) => h.position.quantity))
    const invested = sum(holdings.map((h) => h.position.invested))
    const currentValue = price ? quantity * price.lastPrice : null
    const unrealizedPnl = currentValue === null ? null : currentValue - invested
    const previousClose = price?.previousClose ?? null

    const byMember = new Map<string, StockHolder>()
    for (const { memberId, holding } of group) {
      const holder = byMember.get(memberId) ?? {
        memberId,
        quantity: 0,
        currentValue: price ? 0 : null,
      }
      holder.quantity += holding.position.quantity
      if (holder.currentValue !== null && holding.currentValue !== null) {
        holder.currentValue += holding.currentValue
      }
      byMember.set(memberId, holder)
    }

    const parts: ReturnPart[] = holdings.map((holding) => ({
      flows: holding.flows,
      held: true,
      currentValue: holding.currentValue,
      valuedOn: holding.price?.pricedAt ?? null,
    }))

    return {
      instrumentId,
      quantity,
      invested,
      averageCost: quantity > 0 ? invested / quantity : 0,
      price,
      currentValue,
      unrealizedPnl,
      unrealizedPct:
        unrealizedPnl !== null && invested > 0
          ? (unrealizedPnl / invested) * 100
          : null,
      dayChange:
        price && previousClose !== null
          ? quantity * (price.lastPrice - previousClose)
          : null,
      dayChangePct:
        price && previousClose !== null && previousClose > 0
          ? ((price.lastPrice - previousClose) / previousClose) * 100
          : null,
      xirr: combinedAnnualReturn(parts),
      weightPct: null,
      holders: [...byMember.values()].sort((a, b) => b.quantity - a.quantity),
    } satisfies FamilyStock
  })

  const pricedTotal = sum(stocks.map((stock) => stock.currentValue ?? 0))
  return stocks
    .map((stock) => ({
      ...stock,
      weightPct:
        stock.currentValue !== null && pricedTotal > 0
          ? (stock.currentValue / pricedTotal) * 100
          : null,
    }))
    .sort(
      (a, b) =>
        (b.currentValue ?? -1) - (a.currentValue ?? -1) ||
        b.invested - a.invested,
    )
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0)
}
