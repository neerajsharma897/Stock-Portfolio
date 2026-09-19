// Breakdowns for the Stocks page: sectors, concentration, holding periods,
// brokers and money put in each month. All worked out from saved entries and
// prices; nothing here is stored.

import type { FamilyStock } from "@/lib/portfolio/family-stocks"
import type { Lot } from "@/lib/portfolio/holdings"
import type { ValuedHolding } from "@/lib/portfolio/valuation"
import type { CashFlow } from "@/lib/portfolio/xirr"
import { isLongTerm, longTermOn } from "@/lib/tax/capital-gains"

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0)

export const UNCLASSIFIED = "Not classified"

export type Slice = {
  label: string
  value: number
  /** Percent of the priced total. */
  weightPct: number
  instrumentIds: number[]
}

/** Priced stocks grouped by a label (e.g. sector), largest first; the unclassified group last. */
export function groupStocks(
  stocks: readonly FamilyStock[],
  labelOf: (stock: FamilyStock) => string | null,
): Slice[] {
  const priced = stocks.filter((stock) => stock.currentValue !== null)
  const total = sum(priced.map((stock) => stock.currentValue ?? 0))
  const groups = new Map<string, Slice>()
  for (const stock of priced) {
    const label = labelOf(stock) ?? UNCLASSIFIED
    const slice = groups.get(label) ?? {
      label,
      value: 0,
      weightPct: 0,
      instrumentIds: [],
    }
    slice.value += stock.currentValue ?? 0
    slice.instrumentIds.push(stock.instrumentId)
    groups.set(label, slice)
  }
  return [...groups.values()]
    .map((slice) => ({
      ...slice,
      weightPct: total > 0 ? (slice.value / total) * 100 : 0,
    }))
    .sort(
      (a, b) =>
        Number(a.label === UNCLASSIFIED) - Number(b.label === UNCLASSIFIED) ||
        b.value - a.value,
    )
}

/** A single stock above this share of the stocks is flagged. */
export const HEAVY_STOCK_PCT = 20

export type Concentration = {
  count: number
  largest: { instrumentId: number; weightPct: number } | null
  /** Share of the five largest stocks, in percent. */
  top5Pct: number
  /** Spread like this many equal-sized stocks (1 / sum of squared weights). */
  effectiveCount: number
  heavy: { instrumentId: number; weightPct: number }[]
}

export function concentration(stocks: readonly FamilyStock[]): Concentration {
  const weighted = stocks
    .filter((stock) => stock.weightPct !== null)
    .map((stock) => ({
      instrumentId: stock.instrumentId,
      weightPct: stock.weightPct ?? 0,
    }))
    .sort((a, b) => b.weightPct - a.weightPct)
  const squares = sum(weighted.map((stock) => (stock.weightPct / 100) ** 2))
  return {
    count: weighted.length,
    largest: weighted[0] ?? null,
    top5Pct: sum(weighted.slice(0, 5).map((stock) => stock.weightPct)),
    effectiveCount: squares > 0 ? 1 / squares : 0,
    heavy: weighted.filter((stock) => stock.weightPct > HEAVY_STOCK_PCT),
  }
}

// Holding periods -----------------------------------------------------------

/** Listed shares and gold bonds become long-term after 12 months. */
export const LONG_TERM_MONTHS = 12

export type TermPart = { value: number; gain: number }

export type TurningLongTerm = {
  memberId: string
  instrumentId: number
  quantity: number
  /** First day a sale is long-term. */
  longTermOn: string
  gain: number
}

export type HoldingTerms = {
  longTerm: TermPart
  shortTerm: TermPart
  /** Lots turning long-term within the window, soonest first. */
  soon: TurningLongTerm[]
  /** Some shares came from opening balances, whose dates may not be the real purchase dates. */
  estimated: boolean
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

/** Priced open lots split into short- and long-term, with lots turning long-term soon. */
export function holdingTerms(
  members: readonly {
    member: { id: string }
    holdings: readonly ValuedHolding[]
  }[],
  today: string,
  soonDays = 60,
): HoldingTerms {
  const result: HoldingTerms = {
    longTerm: { value: 0, gain: 0 },
    shortTerm: { value: 0, gain: 0 },
    soon: [],
    estimated: false,
  }
  const until = addDays(today, soonDays)

  for (const { member, holdings } of members) {
    for (const holding of holdings) {
      if (!holding.price || holding.position.quantity <= 0) continue
      const lastPrice = holding.price.lastPrice
      // Lots of one stock and account that turn long-term on the same day are one row.
      const soonByDate = new Map<string, TurningLongTerm>()
      for (const lot of holding.position.lots) {
        const value = lot.quantity * lastPrice
        const gain = value - lot.quantity * lot.costPerShare
        const part = isLongTerm(lot.date, today, LONG_TERM_MONTHS)
          ? result.longTerm
          : result.shortTerm
        part.value += value
        part.gain += gain
        if (lot.source === "opening_balance") result.estimated = true

        const on = longTermOn(lot.date, LONG_TERM_MONTHS)
        if (on > today && on <= until) {
          const row = soonByDate.get(on) ?? {
            memberId: member.id,
            instrumentId: holding.instrumentId,
            quantity: 0,
            longTermOn: on,
            gain: 0,
          }
          row.quantity += lot.quantity
          row.gain += gain
          soonByDate.set(on, row)
        }
      }
      result.soon.push(...soonByDate.values())
    }
  }
  result.soon.sort((a, b) => a.longTermOn.localeCompare(b.longTermOn))
  return result
}

/** Unrealised gain (net of losses) of the lots held long enough to be long-term today. */
export function longTermUnrealized(
  lots: readonly Lot[],
  lastPrice: number,
  today: string,
): number {
  return sum(
    lots
      .filter((lot) => isLongTerm(lot.date, today, LONG_TERM_MONTHS))
      .map((lot) => lot.quantity * (lastPrice - lot.costPerShare)),
  )
}

// Money put in and taken out --------------------------------------------------

export type MonthFlow = {
  /** "2026-09" */
  month: string
  /** Buys, including charges. */
  putIn: number
  /** Sells, after charges. */
  takenOut: number
}

/** The last `months` months up to today's, oldest first, with empty months included. */
export function monthlyFlows(
  flows: readonly CashFlow[],
  today: string,
  months = 24,
): MonthFlow[] {
  const [year, month] = today.split("-").map(Number)
  const result: MonthFlow[] = []
  for (let back = months - 1; back >= 0; back--) {
    const total = year * 12 + (month - 1) - back
    result.push({
      month: `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`,
      putIn: 0,
      takenOut: 0,
    })
  }
  const byMonth = new Map(result.map((row) => [row.month, row]))
  for (const flow of flows) {
    const row = byMonth.get(flow.date.slice(0, 7))
    if (!row) continue
    if (flow.amount < 0) row.putIn -= flow.amount
    else row.takenOut += flow.amount
  }
  return result
}
