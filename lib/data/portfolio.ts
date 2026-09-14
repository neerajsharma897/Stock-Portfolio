import "server-only"

import { requireOwner } from "@/lib/auth"
import {
  fetchFundTransactions,
  toFundHoldingTransaction,
  toFundNav,
  type FundScheme,
} from "@/lib/data/mutual-funds"
import { fetchPrices } from "@/lib/data/prices"
import {
  toHoldingTransaction,
  type TransactionInstrument,
} from "@/lib/data/transactions"
import {
  combinedReturn,
  forFamilyTotals,
  groupFundHoldings,
  valueFund,
  type FundProblem,
  type ValuedFund,
} from "@/lib/mutual-funds/portfolio"
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
import { readAllRows } from "@/lib/supabase/read-all"
import { createClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/lib/supabase/types"

export type MemberPortfolio = {
  member: Pick<Tables<"members">, "id" | "name" | "color" | "relation">
  holdings: ValuedHolding[]
  problems: HoldingProblem[]
  funds: ValuedFund[]
  fundProblems: FundProblem[]
  /** Stocks and mutual funds together. */
  summary: PortfolioSummary
  fundSummary: PortfolioSummary
  fundXirr: number | null
}

export type FamilyPortfolio = {
  members: MemberPortfolio[]
  /** Stocks and mutual funds together. "Today" covers stocks only. */
  summary: PortfolioSummary
  fundSummary: PortfolioSummary
  fundXirr: number | null
  instruments: Map<number, TransactionInstrument>
  schemes: Map<number, FundScheme>
  priceItems: PriceItem[]
  movers: { gainers: Mover[]; losers: Mover[] }
}

/** Every active (not archived) member's stocks and funds, valued with saved prices and NAVs. */
export async function getFamilyPortfolio(): Promise<FamilyPortfolio> {
  await requireOwner()
  return buildFamilyPortfolio(await createClient())
}

/** Same as getFamilyPortfolio, with any client (scheduled jobs use the admin client). */
export async function buildFamilyPortfolio(
  supabase: AppSupabaseClient,
): Promise<FamilyPortfolio> {
  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id, name, color, relation")
    .is("archived_at", null)
    .order("created_at")
  if (membersError) {
    throw new Error(`Couldn't load members: ${membersError.message}`)
  }

  const memberIds = members.map((member) => member.id)
  const [transactions, fundTransactions] = await Promise.all([
    memberIds.length === 0
      ? []
      : readAllRows("transactions", (from, to) =>
          supabase
            .from("transactions")
            .select(
              "id, type, quantity, price, charges, trade_date, created_at, broker_account_id, instrument_id, member_id, instrument:instruments(id, exchange, symbol, name, series, kind)",
            )
            .in("member_id", memberIds)
            .order("id")
            .range(from, to),
        ),
    fetchFundTransactions(supabase, memberIds),
  ])

  const instruments = new Map<number, TransactionInstrument>(
    transactions.map((transaction) => [
      transaction.instrument_id,
      transaction.instrument,
    ]),
  )
  const schemes = new Map<number, FundScheme>(
    fundTransactions.map((transaction) => [
      transaction.amfi_code,
      transaction.scheme,
    ]),
  )
  const prices = await fetchPrices(supabase, instruments.keys())

  const memberPortfolios = members.map((member) => {
    const { holdings, problems } = groupHoldings(
      transactions
        .filter((transaction) => transaction.member_id === member.id)
        .map(toHoldingTransaction),
    )
    const valued = holdings.map((holding) =>
      valueHolding(holding, prices.get(holding.instrumentId) ?? null),
    )

    const { holdings: fundHoldings, problems: fundProblems } =
      groupFundHoldings(
        fundTransactions
          .filter((transaction) => transaction.member_id === member.id)
          .map(toFundHoldingTransaction),
      )
    const funds = fundHoldings.map((holding) =>
      valueFund(holding, toFundNav(schemes.get(holding.amfiCode))),
    )

    return {
      member,
      holdings: valued,
      problems,
      funds,
      fundProblems,
      summary: summarize([...valued, ...forFamilyTotals(funds)]),
      fundSummary: summarize(funds),
      fundXirr: combinedReturn(funds),
    }
  })

  const allHoldings = memberPortfolios.flatMap(
    (portfolio) => portfolio.holdings,
  )
  const allFunds = memberPortfolios.flatMap((portfolio) => portfolio.funds)
  return {
    members: memberPortfolios,
    summary: summarize([...allHoldings, ...forFamilyTotals(allFunds)]),
    fundSummary: summarize(allFunds),
    fundXirr: combinedReturn(allFunds),
    instruments,
    schemes,
    priceItems: buildPriceItems(allHoldings, instruments),
    movers: topMovers(allHoldings),
  }
}
