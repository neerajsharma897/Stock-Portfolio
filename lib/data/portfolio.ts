import "server-only"

import { requireOwner } from "@/lib/auth"
import {
  forFamilyTotals as cryptoForFamilyTotals,
  groupCryptoHoldings,
  valueCrypto,
  type CryptoProblem,
  type ValuedCrypto,
} from "@/lib/crypto/portfolio"
import { fetchCorporateActions } from "@/lib/data/corporate-actions"
import {
  fetchCryptoTransactions,
  toCoinPrice,
  toCryptoHoldingTransaction,
  type Coin,
} from "@/lib/data/crypto"
import {
  fetchOtherAssets,
  type Deposit,
  type IpoApplication,
  type OtherAsset,
} from "@/lib/data/other-assets"
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
import { todayInIndia } from "@/lib/dates"
import {
  depositForTotals,
  otherAssetForTotals,
} from "@/lib/other-assets/portfolio"
import { overallReturn } from "@/lib/portfolio/overall-return"
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
  type SummaryInput,
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
  crypto: ValuedCrypto[]
  cryptoProblems: CryptoProblem[]
  deposits: Deposit[]
  otherAssets: OtherAsset[]
  /** Not counted in totals. */
  ipos: IpoApplication[]
  /** Stocks, mutual funds, crypto, FDs and other assets together. */
  summary: PortfolioSummary
  /** Yearly return of stocks, funds, crypto and FDs; null under a year or with unpriced holdings. */
  xirr: number | null
  fundSummary: PortfolioSummary
  fundXirr: number | null
  /** "Today" is the last 24 hours. */
  cryptoSummary: PortfolioSummary
}

export type AssetClass = {
  key: "stocks" | "funds" | "crypto" | "deposits" | "other"
  label: string
  /** Page listing this asset type across the family, if there is one. */
  href: string | null
  summary: PortfolioSummary
}

export type FamilyPortfolio = {
  members: MemberPortfolio[]
  /** Everything together. "Today" covers stocks only. */
  summary: PortfolioSummary
  xirr: number | null
  assetClasses: AssetClass[]
  fundSummary: PortfolioSummary
  fundXirr: number | null
  cryptoSummary: PortfolioSummary
  instruments: Map<number, TransactionInstrument>
  schemes: Map<number, FundScheme>
  coins: Map<string, Coin>
  priceItems: PriceItem[]
  movers: { gainers: Mover[]; losers: Mover[] }
}

/** Every active (not archived) member's investments, valued with saved prices, NAVs and today's FD interest. */
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
  const today = todayInIndia()
  const [transactions, fundTransactions, cryptoTransactions, others] =
    await Promise.all([
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
      fetchCryptoTransactions(supabase, memberIds),
      fetchOtherAssets(supabase, memberIds, today),
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
  const coins = new Map<string, Coin>(
    cryptoTransactions.map((transaction) => [
      transaction.market,
      transaction.coin,
    ]),
  )
  const [prices, corporateActions] = await Promise.all([
    fetchPrices(supabase, instruments.keys()),
    fetchCorporateActions(supabase, instruments.keys()),
  ])

  const memberPortfolios = members.map((member) => {
    const { holdings, problems } = groupHoldings(
      transactions
        .filter((transaction) => transaction.member_id === member.id)
        .map(toHoldingTransaction),
      corporateActions,
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

    const { holdings: cryptoHoldings, problems: cryptoProblems } =
      groupCryptoHoldings(
        cryptoTransactions
          .filter((transaction) => transaction.member_id === member.id)
          .map(toCryptoHoldingTransaction),
      )
    const crypto = cryptoHoldings.map((holding) =>
      valueCrypto(holding, toCoinPrice(coins.get(holding.market))),
    )

    const deposits = others.deposits.filter(
      (deposit) => deposit.memberId === member.id,
    )
    const otherAssets = others.otherAssets.filter(
      (asset) => asset.memberId === member.id,
    )

    return {
      member,
      holdings: valued,
      problems,
      funds,
      fundProblems,
      crypto,
      cryptoProblems,
      deposits,
      otherAssets,
      ipos: others.ipos.filter((ipo) => ipo.member_id === member.id),
      summary: summarize([
        ...valued,
        ...forFamilyTotals(funds),
        ...cryptoForFamilyTotals(crypto),
        ...deposits.map((deposit) => depositForTotals(deposit, today)),
        ...otherAssets.map(otherAssetForTotals),
      ]),
      xirr: overallReturn({ holdings: valued, funds, crypto, deposits }, today),
      fundSummary: summarize(funds),
      fundXirr: combinedReturn(funds),
      cryptoSummary: summarize(crypto),
    }
  })

  const allHoldings = memberPortfolios.flatMap(
    (portfolio) => portfolio.holdings,
  )
  const allFunds = memberPortfolios.flatMap((portfolio) => portfolio.funds)
  const allCrypto = memberPortfolios.flatMap((portfolio) => portfolio.crypto)
  const classInputs: Record<AssetClass["key"], SummaryInput[]> = {
    stocks: allHoldings,
    funds: forFamilyTotals(allFunds),
    crypto: cryptoForFamilyTotals(allCrypto),
    deposits: memberPortfolios.flatMap((portfolio) =>
      portfolio.deposits.map((deposit) => depositForTotals(deposit, today)),
    ),
    other: memberPortfolios.flatMap((portfolio) =>
      portfolio.otherAssets.map(otherAssetForTotals),
    ),
  }
  const classes: Omit<AssetClass, "summary">[] = [
    { key: "stocks", label: "Stocks", href: null },
    { key: "funds", label: "Mutual funds", href: "/mutual-funds" },
    { key: "crypto", label: "Crypto", href: "/crypto" },
    { key: "deposits", label: "Fixed deposits", href: "/other-assets" },
    { key: "other", label: "Gold, PPF & other", href: "/other-assets" },
  ]
  return {
    members: memberPortfolios,
    summary: summarize(Object.values(classInputs).flat()),
    xirr: overallReturn(
      {
        holdings: allHoldings,
        funds: allFunds,
        crypto: allCrypto,
        deposits: memberPortfolios.flatMap((portfolio) => portfolio.deposits),
      },
      today,
    ),
    assetClasses: classes.map((assetClass) => ({
      ...assetClass,
      summary: summarize(classInputs[assetClass.key]),
    })),
    fundSummary: summarize(allFunds),
    fundXirr: combinedReturn(allFunds),
    cryptoSummary: summarize(allCrypto),
    instruments,
    schemes,
    coins,
    priceItems: buildPriceItems(allHoldings, instruments),
    movers: topMovers(allHoldings),
  }
}
