import "server-only"

import writeXlsxFile, { type Cell, type Sheet } from "write-excel-file/node"

import type { FinancialYear } from "@/lib/crypto/tax"
import { getFamilyPortfolio } from "@/lib/data/portfolio"
import { buildGainLines } from "@/lib/data/reports"
import { createClient } from "@/lib/supabase/server"
import { readAllRows } from "@/lib/supabase/read-all"
import { MF_TRANSACTION_LABELS } from "@/lib/mutual-funds/options"
import {
  FD_INTEREST_LABELS,
  IPO_STATUS_LABELS,
  OTHER_ASSET_LABELS,
} from "@/lib/other-assets/options"
import { GAIN_ASSET_LABELS, summarizeGains } from "@/lib/tax/capital-gains"
import { TRANSACTION_TYPE_LABELS } from "@/lib/transactions/options"

type Row = Cell[]

const MONEY = "#,##0.00"
const QUANTITY = "#,##0.########"
const PERCENT = "0.00%"

function header(labels: string[]): Row {
  return labels.map((value) => ({ value, fontWeight: "bold" as const }))
}

function money(value: number | null): Cell {
  return value === null ? null : { value, type: Number, format: MONEY }
}

function quantity(value: number): Cell {
  return { value, type: Number, format: QUANTITY }
}

function percent(fraction: number | null): Cell {
  return fraction === null
    ? null
    : { value: fraction, type: Number, format: PERCENT }
}

/** A YYYY-MM-DD date as a real Excel date. */
function date(value: string | null): Cell {
  return value === null
    ? null
    : {
        value: new Date(`${value}T00:00:00Z`),
        type: Date,
        format: "dd mmm yyyy",
      }
}

function sheet(
  name: string,
  labels: string[],
  rows: Row[],
  widths: number[],
): Sheet<Buffer> {
  return {
    sheet: name,
    data: [header(labels), ...rows],
    columns: widths.map((width) => ({ width })),
    stickyRowsCount: 1,
  }
}

/**
 * Everything worth reading in a spreadsheet: holdings, the year's capital gains
 * and every entry. For restoring, use the JSON download instead.
 */
export async function buildWorkbook(year: FinancialYear): Promise<Buffer> {
  const portfolio = await getFamilyPortfolio()
  const supabase = await createClient()
  const [stockEntries, fundEntries, cryptoEntries] = await Promise.all([
    readAllRows("transactions", (from, to) =>
      supabase
        .from("transactions")
        .select(
          "trade_date, type, quantity, price, charges, notes, member:members(name), instrument:instruments(symbol, exchange)",
        )
        .order("trade_date")
        .order("id")
        .range(from, to),
    ),
    readAllRows("mutual fund entries", (from, to) =>
      supabase
        .from("mf_transactions")
        .select(
          "trade_date, type, units, nav, charges, folio_number, notes, member:members(name), scheme:mf_schemes(name)",
        )
        .order("trade_date")
        .order("id")
        .range(from, to),
    ),
    readAllRows("crypto entries", (from, to) =>
      supabase
        .from("crypto_transactions")
        .select(
          "trade_date, type, quantity, price, charges, notes, member:members(name), coin:crypto_assets(symbol)",
        )
        .order("trade_date")
        .order("id")
        .range(from, to),
    ),
  ])

  const { instruments, schemes, coins } = portfolio
  const holdings: Row[] = portfolio.members.flatMap(
    ({ member, holdings, funds, crypto, deposits, otherAssets }) => [
      ...holdings
        .filter((holding) => holding.position.quantity > 0)
        .map((holding): Row => {
          const instrument = instruments.get(holding.instrumentId)
          return [
            member.name,
            instrument?.kind === "sgb" ? "Gold bond" : "Stock",
            `${instrument?.symbol ?? "Unknown"} (${instrument?.exchange ?? ""})`,
            quantity(holding.position.quantity),
            money(holding.position.averageCost),
            money(holding.price?.lastPrice ?? null),
            money(holding.currentValue),
            money(holding.position.invested),
            money(holding.unrealizedPnl),
            percent(holding.xirr),
          ]
        }),
      ...funds
        .filter((fund) => fund.position.quantity > 0)
        .map((fund): Row => [
          member.name,
          "Mutual fund",
          schemes.get(fund.amfiCode)?.name ?? "Unknown fund",
          quantity(fund.position.quantity),
          money(fund.position.averageCost),
          money(fund.price?.lastPrice ?? null),
          money(fund.currentValue),
          money(fund.position.invested),
          money(fund.unrealizedPnl),
          percent(fund.xirr),
        ]),
      ...crypto
        .filter((holding) => holding.position.quantity > 0)
        .map((holding): Row => [
          member.name,
          "Crypto",
          coins.get(holding.market)?.symbol ?? holding.market,
          quantity(holding.position.quantity),
          money(holding.position.averageCost),
          money(holding.price?.lastPrice ?? null),
          money(holding.currentValue),
          money(holding.position.invested),
          money(holding.unrealizedPnl),
          percent(holding.xirr),
        ]),
      ...deposits
        .filter((deposit) => !deposit.closed)
        .map((deposit): Row => [
          member.name,
          "Fixed deposit",
          `${deposit.bank} at ${deposit.ratePct}%`,
          null,
          null,
          null,
          money(deposit.value),
          money(deposit.principal),
          money(deposit.value - deposit.principal),
          null,
        ]),
      ...otherAssets.map((asset): Row => [
        member.name,
        OTHER_ASSET_LABELS[asset.kind],
        asset.name,
        null,
        null,
        null,
        money(asset.currentValue),
        money(asset.invested),
        money(asset.currentValue - asset.invested),
        null,
      ]),
    ],
  )

  const gains: Row[] = buildGainLines(portfolio).flatMap(({ member, lines }) =>
    summarizeGains(lines, year).lines.map((line): Row => [
      member.name,
      date(line.saleDate),
      line.name,
      GAIN_ASSET_LABELS[line.asset],
      line.term === "short"
        ? "Short-term"
        : line.term === "long"
          ? "Long-term"
          : "Flat 30%",
      quantity(line.quantity),
      money(line.saleValue),
      money(line.expenses),
      money(line.cost),
      money(line.gain),
      date(line.boughtFrom),
      line.estimated ? "Yes (opening balance)" : "",
    ]),
  )

  const deposits: Row[] = portfolio.members.flatMap(({ member, deposits }) =>
    deposits.map((deposit): Row => [
      member.name,
      deposit.bank,
      money(deposit.principal),
      { value: deposit.ratePct / 100, type: Number, format: PERCENT },
      FD_INTEREST_LABELS[deposit.interest],
      date(deposit.startDate),
      date(deposit.maturityDate),
      date(deposit.closedOn),
      money(deposit.closed ? null : deposit.value),
      money(deposit.maturityValue),
    ]),
  )

  const ipos: Row[] = portfolio.members.flatMap(({ member, ipos }) =>
    ipos.map((ipo): Row => [
      member.name,
      ipo.company,
      date(ipo.applied_on),
      quantity(ipo.shares_applied),
      money(Number(ipo.price)),
      IPO_STATUS_LABELS[ipo.status],
      ipo.shares_allotted === null ? null : quantity(ipo.shares_allotted),
    ]),
  )

  const sheets: Sheet<Buffer>[] = [
    sheet(
      "Holdings",
      [
        "Member",
        "Type",
        "Name",
        "Quantity",
        "Avg cost",
        "Price",
        "Value",
        "Invested",
        "Gain",
        "XIRR",
      ],
      holdings,
      [16, 14, 40, 12, 12, 12, 14, 14, 14, 9],
    ),
    sheet(
      `Gains ${year.label}`,
      [
        "Member",
        "Sold on",
        "Name",
        "Type",
        "Term",
        "Quantity",
        "Sale value",
        "Charges",
        "Cost",
        "Gain",
        "Bought from",
        "Estimated",
      ],
      gains,
      [16, 13, 36, 13, 11, 12, 14, 11, 14, 14, 13, 20],
    ),
    sheet(
      "Stock entries",
      [
        "Member",
        "Date",
        "Type",
        "Stock",
        "Exchange",
        "Quantity",
        "Price",
        "Charges",
        "Notes",
      ],
      stockEntries.map((entry): Row => [
        entry.member.name,
        date(entry.trade_date),
        TRANSACTION_TYPE_LABELS[entry.type],
        entry.instrument.symbol,
        entry.instrument.exchange,
        quantity(Number(entry.quantity)),
        money(Number(entry.price)),
        money(Number(entry.charges)),
        entry.notes ?? "",
      ]),
      [16, 13, 15, 16, 9, 12, 12, 11, 30],
    ),
    sheet(
      "Fund entries",
      [
        "Member",
        "Date",
        "Type",
        "Fund",
        "Folio",
        "Units",
        "NAV",
        "Charges",
        "Notes",
      ],
      fundEntries.map((entry): Row => [
        entry.member.name,
        date(entry.trade_date),
        MF_TRANSACTION_LABELS[entry.type],
        entry.scheme.name,
        entry.folio_number ?? "",
        quantity(Number(entry.units)),
        money(Number(entry.nav)),
        money(Number(entry.charges)),
        entry.notes ?? "",
      ]),
      [16, 13, 15, 44, 14, 12, 12, 11, 30],
    ),
    sheet(
      "Crypto entries",
      ["Member", "Date", "Type", "Coin", "Quantity", "Price", "Fees", "Notes"],
      cryptoEntries.map((entry): Row => [
        entry.member.name,
        date(entry.trade_date),
        TRANSACTION_TYPE_LABELS[entry.type],
        entry.coin.symbol,
        quantity(Number(entry.quantity)),
        {
          value: Number(entry.price),
          type: Number,
          format: "#,##0.00########",
        },
        money(Number(entry.charges)),
        entry.notes ?? "",
      ]),
      [16, 13, 15, 10, 14, 16, 11, 30],
    ),
    sheet(
      "FDs",
      [
        "Member",
        "Bank",
        "Amount",
        "Rate",
        "Interest",
        "Start",
        "Maturity",
        "Closed",
        "Value today",
        "At maturity",
      ],
      deposits,
      [16, 20, 14, 8, 22, 13, 13, 13, 14, 14],
    ),
    sheet(
      "IPO applications",
      [
        "Member",
        "Company",
        "Applied on",
        "Shares",
        "Price",
        "Status",
        "Allotted",
      ],
      ipos,
      [16, 30, 13, 10, 12, 14, 10],
    ),
  ]

  return writeXlsxFile(sheets).toBuffer()
}
