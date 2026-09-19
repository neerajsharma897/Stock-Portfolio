import "server-only"

import { financialYearOf } from "@/lib/crypto/tax"
import {
  getSectors,
  listBrokerAccounts,
  type BrokerAccount,
} from "@/lib/data/insights"
import type { FamilyPortfolio } from "@/lib/data/portfolio"
import { buildGainLines } from "@/lib/data/reports"
import { BROKER_LABELS } from "@/lib/members/options"
import type { FamilyStock } from "@/lib/portfolio/family-stocks"
import {
  concentration,
  groupStocks,
  holdingTerms,
  longTermUnrealized,
  monthlyFlows,
  type Concentration,
  type HoldingTerms,
  type MonthFlow,
  type Slice,
} from "@/lib/portfolio/insights"
import { GOLD_BONDS_SECTOR } from "@/lib/sectors/names"
import { fundTaxClass } from "@/lib/tax/capital-gains"
import { taxFreeRoom, type TaxFreeRoom } from "@/lib/tax/tax-free"

export type BrokerSplitRow = {
  broker: string
  label: string
  value: number
  pct: number
  memberNames: string[]
  accountCount: number
}

export type StockInsights = {
  sectors: Slice[]
  sectorsLoaded: boolean
  sectorsMissing: boolean
  concentration: Concentration
  brokers: BrokerSplitRow[]
  terms: HoldingTerms
  taxFree: {
    yearLabel: string
    rows: {
      member: FamilyPortfolio["members"][number]["member"]
      room: TaxFreeRoom
    }[]
  }
  months: MonthFlow[]
}

function brokerSplit(
  portfolio: FamilyPortfolio,
  accounts: Map<string, BrokerAccount>,
): BrokerSplitRow[] {
  const memberNames = new Map(
    portfolio.members.map(({ member }) => [member.id, member.name]),
  )
  const rows = new Map<
    string,
    { value: number; members: Set<string>; accounts: Set<string> }
  >()
  for (const { holdings } of portfolio.members) {
    for (const holding of holdings) {
      if (holding.currentValue === null || holding.position.quantity <= 0) {
        continue
      }
      const account = accounts.get(holding.brokerAccountId)
      const broker = account?.broker ?? "unknown"
      const row = rows.get(broker) ?? {
        value: 0,
        members: new Set<string>(),
        accounts: new Set<string>(),
      }
      row.value += holding.currentValue
      if (account) {
        row.members.add(memberNames.get(account.member_id) ?? "Unknown")
      }
      row.accounts.add(holding.brokerAccountId)
      rows.set(broker, row)
    }
  }
  const total = [...rows.values()].reduce((sum, row) => sum + row.value, 0)
  return [...rows.entries()]
    .map(([broker, row]) => ({
      broker,
      label:
        broker in BROKER_LABELS
          ? BROKER_LABELS[broker as keyof typeof BROKER_LABELS]
          : "Unknown broker",
      value: row.value,
      pct: total > 0 ? (row.value / total) * 100 : 0,
      memberNames: [...row.members].sort(),
      accountCount: row.accounts.size,
    }))
    .sort((a, b) => b.value - a.value)
}

/** Unrealised long-term gain on shares and equity funds, per member. */
function longTermGains(portfolio: FamilyPortfolio, today: string) {
  const { instruments, schemes } = portfolio
  return new Map(
    portfolio.members.map(({ member, holdings, funds }) => {
      let gain = 0
      for (const holding of holdings) {
        if (!holding.price || holding.position.quantity <= 0) continue
        if (instruments.get(holding.instrumentId)?.kind !== "equity") continue
        gain += longTermUnrealized(
          holding.position.lots,
          holding.price.lastPrice,
          today,
        )
      }
      for (const fund of funds) {
        if (!fund.price || fund.position.quantity <= 0) continue
        const scheme = schemes.get(fund.amfiCode)
        if (
          fundTaxClass(scheme?.category ?? null, scheme?.name ?? "") !==
          "equity_fund"
        ) {
          continue
        }
        gain += longTermUnrealized(
          fund.position.lots,
          fund.price.lastPrice,
          today,
        )
      }
      return [member.id, gain]
    }),
  )
}

/** Everything the Stocks page's breakdown cards show. */
export async function getStockInsights(
  portfolio: FamilyPortfolio,
  stocks: readonly FamilyStock[],
  today: string,
): Promise<StockInsights> {
  const { instruments } = portfolio
  const symbols = stocks.flatMap(
    (stock) => instruments.get(stock.instrumentId)?.symbol ?? [],
  )
  const [sectorInfo, accounts] = await Promise.all([
    getSectors(symbols),
    listBrokerAccounts(),
  ])

  const sectors = groupStocks(stocks, (stock) => {
    const instrument = instruments.get(stock.instrumentId)
    if (instrument?.kind === "sgb") return GOLD_BONDS_SECTOR
    return instrument
      ? (sectorInfo.bySymbol.get(instrument.symbol) ?? null)
      : null
  })

  const year = financialYearOf(today)
  const gains = longTermGains(portfolio, today)
  const taxFreeRows = buildGainLines(portfolio)
    .map(({ member, lines }) => ({
      member,
      room: taxFreeRoom(lines, year, gains.get(member.id) ?? 0),
    }))
    .filter(({ room }) => room.used > 0 || room.longTermGain !== 0)

  const flows = portfolio.members.flatMap(({ holdings }) =>
    holdings.flatMap((holding) => holding.flows),
  )

  return {
    sectors,
    sectorsLoaded: sectorInfo.loaded,
    sectorsMissing: sectorInfo.missing,
    concentration: concentration(stocks),
    brokers: brokerSplit(portfolio, accounts),
    terms: holdingTerms(portfolio.members, today),
    taxFree: { yearLabel: year.label, rows: taxFreeRows },
    months: monthlyFlows(flows, today),
  }
}
