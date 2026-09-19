// Capital gains for India's income tax return, as an estimate. Each sell is
// split by the purchase lots it used (first in, first out) into short- and
// long-term parts. Rates are the ones from 23 July 2024 (20% short-term and
// 12.5% long-term above ₹1.25 lakh for listed shares and equity funds); sales
// before that date use the old 15% and 10%. Not covered: grandfathering of
// shares bought before February 2018, surcharge, and losses carried forward.

import type { MatchedLot, Sale } from "@/lib/portfolio/holdings"
import type { FinancialYear } from "@/lib/crypto/tax"

export type GainAsset =
  "equity" | "equity_fund" | "other_fund" | "gold_bond" | "crypto"

export const GAIN_ASSET_LABELS: Record<GainAsset, string> = {
  equity: "Shares",
  equity_fund: "Equity fund",
  other_fund: "Other fund",
  gold_bond: "Gold bond",
  crypto: "Crypto",
}

// Months held before a gain is long-term; crypto has one flat rate.
const LONG_TERM_MONTHS: Record<GainAsset, number | null> = {
  equity: 12,
  equity_fund: 12,
  gold_bond: 12,
  other_fund: 24,
  crypto: null,
}

const OLD_RATES_UNTIL = "2024-07-22"
const CESS = 0.04
const CRYPTO_RATE = 0.3
const TDS_RATE = 0.01

export type GainLine = {
  asset: GainAsset
  /** Symbol, fund or coin. */
  name: string
  memberId: string
  saleDate: string
  /** Earliest and latest purchase dates of the shares sold in this part. */
  boughtFrom: string
  boughtTo: string
  quantity: number
  saleValue: number
  /** Selling charges; not deductible for crypto. */
  expenses: number
  /** What the shares sold cost, including buy charges. */
  cost: number
  gain: number
  /** Null for crypto, which has one rate whatever the holding period. */
  term: "short" | "long" | null
  /** Some shares came from an opening balance, whose date and cost are approximate. */
  estimated: boolean
}

/** True when held for more than `months` months. */
export function isLongTerm(
  bought: string,
  sold: string,
  months: number,
): boolean {
  const [year, month, day] = bought.split("-").map(Number)
  const total = year * 12 + (month - 1) + months
  const anniversary = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  return sold > anniversary
}

/** One line per sale and holding term. */
export function gainLines(
  sale: Sale,
  {
    asset,
    name,
    memberId,
  }: { asset: GainAsset; name: string; memberId: string },
): GainLine[] {
  const months = LONG_TERM_MONTHS[asset]
  const parts = new Map<"short" | "long" | "flat", MatchedLot[]>()
  for (const lot of sale.matched) {
    const term =
      months === null
        ? "flat"
        : isLongTerm(lot.date, sale.date, months)
          ? "long"
          : "short"
    const list = parts.get(term)
    if (list) list.push(lot)
    else parts.set(term, [lot])
  }

  return [...parts].map(([term, lots]) => {
    const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0)
    const saleValue = quantity * sale.price
    const expenses =
      asset === "crypto" ? 0 : (sale.charges * quantity) / sale.quantity
    const cost = lots.reduce((sum, lot) => sum + lot.cost, 0)
    const dates = lots.map((lot) => lot.date).sort()
    return {
      asset,
      name,
      memberId,
      saleDate: sale.date,
      boughtFrom: dates[0],
      boughtTo: dates[dates.length - 1],
      quantity,
      saleValue,
      expenses,
      cost,
      gain: saleValue - expenses - cost,
      term: term === "flat" ? null : term,
      estimated: lots.some((lot) => lot.source === "opening_balance"),
    }
  })
}

/** Yearly tax-free long-term gain on listed shares and equity funds. */
export function longTermExemption(year: FinancialYear): number {
  return Number(year.start.slice(0, 4)) >= 2024 ? 125_000 : 100_000
}

function equityRate(saleDate: string, term: "short" | "long") {
  const old = saleDate <= OLD_RATES_UNTIL
  if (term === "short") return old ? 0.15 : 0.2
  return old ? 0.1 : 0.125
}

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0)

/** Rate weighted by the gains taxed at each rate (they differ only in FY 2024-25). */
function weightedRate(lines: readonly GainLine[], term: "short" | "long") {
  const gains = lines.filter((line) => line.gain > 0)
  const total = sum(gains.map((line) => line.gain))
  if (total === 0) return equityRate("9999-12-31", term)
  return (
    sum(gains.map((line) => line.gain * equityRate(line.saleDate, term))) /
    total
  )
}

export type TermTotals = { shortTerm: number; longTerm: number }

export type GainsSummary = {
  year: FinancialYear
  lines: GainLine[]
  /** Listed shares and equity funds. */
  equity: TermTotals & {
    exemption: number
    taxableShortTerm: number
    taxableLongTerm: number
    /** Including 4% cess. */
    tax: number
  }
  /** Taxed at the slab rate short-term; not estimated here. */
  goldBonds: TermTotals
  /** Debt and other funds; rules depend on the fund and purchase date. */
  otherFunds: TermTotals
  crypto: { gains: number; losses: number; tax: number; tds: number }
}

function termTotals(lines: readonly GainLine[]): TermTotals {
  return {
    shortTerm: sum(lines.filter((l) => l.term === "short").map((l) => l.gain)),
    longTerm: sum(lines.filter((l) => l.term === "long").map((l) => l.gain)),
  }
}

/** One person's gains in one financial year, with the tax estimate. */
export function summarizeGains(
  allLines: readonly GainLine[],
  year: FinancialYear,
): GainsSummary {
  const lines = allLines
    .filter((line) => line.saleDate >= year.start && line.saleDate <= year.end)
    .sort((a, b) => a.saleDate.localeCompare(b.saleDate))
  const of = (...assets: GainAsset[]) =>
    lines.filter((line) => assets.includes(line.asset))

  const equityLines = of("equity", "equity_fund")
  const { shortTerm, longTerm } = termTotals(equityLines)
  // A short-term loss can be set off against long-term gains too.
  const taxableShortTerm = Math.max(0, shortTerm)
  const longAfterSetOff = longTerm + Math.min(0, shortTerm)
  const exemption = Math.min(
    longTermExemption(year),
    Math.max(0, longAfterSetOff),
  )
  const taxableLongTerm = Math.max(0, longAfterSetOff - exemption)
  const equityTax =
    (taxableShortTerm *
      weightedRate(
        equityLines.filter((l) => l.term === "short"),
        "short",
      ) +
      taxableLongTerm *
        weightedRate(
          equityLines.filter((l) => l.term === "long"),
          "long",
        )) *
    (1 + CESS)

  const cryptoLines = of("crypto")
  const cryptoGains = sum(
    cryptoLines.filter((l) => l.gain > 0).map((l) => l.gain),
  )

  return {
    year,
    lines,
    equity: {
      shortTerm,
      longTerm,
      exemption,
      taxableShortTerm,
      taxableLongTerm,
      tax: equityTax,
    },
    goldBonds: termTotals(of("gold_bond")),
    otherFunds: termTotals(of("other_fund")),
    crypto: {
      gains: cryptoGains,
      losses: sum(cryptoLines.filter((l) => l.gain < 0).map((l) => l.gain)),
      tax: cryptoGains * CRYPTO_RATE * (1 + CESS),
      tds: sum(cryptoLines.map((l) => l.saleValue)) * TDS_RATE,
    },
  }
}

const EQUITY_CATEGORY =
  /equity scheme|elss|aggressive hybrid|arbitrage|equity savings|balanced advantage|dynamic asset allocation/i
const INDEX_CATEGORY = /index fund|exchange traded|\betf\b/i
const EQUITY_INDEX = /nifty|sensex/i
const NOT_EQUITY =
  /g-?sec|gilt|bond|sdl|psu|liquid|debt|gold|silver|overseas|nasdaq|s&p 500/i

/**
 * Whether a fund is taxed like shares (equity-oriented), from AMFI's category
 * and its name. Anything unclear counts as "other" and gets no tax estimate.
 */
export function fundTaxClass(
  category: string | null,
  name: string,
): "equity_fund" | "other_fund" {
  if (category && EQUITY_CATEGORY.test(category)) return "equity_fund"
  if (
    category &&
    INDEX_CATEGORY.test(category) &&
    EQUITY_INDEX.test(name) &&
    !NOT_EQUITY.test(name)
  ) {
    return "equity_fund"
  }
  return "other_fund"
}
