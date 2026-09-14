import "server-only"

import { requireOwner } from "@/lib/auth"
import { listPrices } from "@/lib/data/prices"
import {
  toHoldingTransaction,
  type TransactionInstrument,
} from "@/lib/data/transactions"
import {
  groupHoldings,
  type HoldingProblem,
} from "@/lib/portfolio/member-holdings"
import {
  buildPriceItems,
  summarize,
  topMovers,
  valueHolding,
  type Mover,
  type PortfolioSummary,
  type PriceItem,
  type ValuedHolding,
} from "@/lib/portfolio/valuation"
import type { Tables } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export type MemberPortfolio = {
  member: Pick<Tables<"members">, "id" | "name" | "color" | "relation">
  holdings: ValuedHolding[]
  problems: HoldingProblem[]
  summary: PortfolioSummary
}

export type FamilyPortfolio = {
  members: MemberPortfolio[]
  summary: PortfolioSummary
  instruments: Map<number, TransactionInstrument>
  priceItems: PriceItem[]
  movers: { gainers: Mover[]; losers: Mover[] }
}

/** Every active (not archived) member's holdings, valued with saved prices. */
export async function getFamilyPortfolio(): Promise<FamilyPortfolio> {
  await requireOwner()
  const supabase = await createClient()

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id, name, color, relation")
    .is("archived_at", null)
    .order("created_at")
  if (membersError) {
    throw new Error(`Couldn't load members: ${membersError.message}`)
  }

  const memberIds = members.map((member) => member.id)
  const { data: transactions, error: transactionsError } =
    memberIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("transactions")
          .select(
            "id, type, quantity, price, charges, trade_date, created_at, broker_account_id, instrument_id, member_id, instrument:instruments(id, exchange, symbol, name, series, kind)",
          )
          .in("member_id", memberIds)
  if (transactionsError) {
    throw new Error(`Couldn't load transactions: ${transactionsError.message}`)
  }

  const instruments = new Map<number, TransactionInstrument>(
    transactions.map((transaction) => [
      transaction.instrument_id,
      transaction.instrument,
    ]),
  )
  const prices = await listPrices(instruments.keys())

  const memberPortfolios = members.map((member) => {
    const { holdings, problems } = groupHoldings(
      transactions
        .filter((transaction) => transaction.member_id === member.id)
        .map(toHoldingTransaction),
    )
    const valued = holdings.map((holding) =>
      valueHolding(holding, prices.get(holding.instrumentId) ?? null),
    )
    return { member, holdings: valued, problems, summary: summarize(valued) }
  })

  const allHoldings = memberPortfolios.flatMap(
    (portfolio) => portfolio.holdings,
  )
  return {
    members: memberPortfolios,
    summary: summarize(allHoldings),
    instruments,
    priceItems: buildPriceItems(allHoldings, instruments),
    movers: topMovers(allHoldings),
  }
}
