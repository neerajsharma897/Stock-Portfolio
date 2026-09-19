// A planning estimate of tax on crypto (virtual digital assets) in India:
// each sale's gain is taxed at a flat 30% plus 4% cess, only the cost of buying
// can be deducted (not selling fees), a loss can't be set off against anything,
// and 1% TDS is deducted from the sale value. The tax return is what counts.

import type { Sale } from "@/lib/portfolio/holdings"

export const CRYPTO_TAX_RATE = 0.3
export const CESS_RATE = 0.04
export const TDS_RATE = 0.01

export type FinancialYear = {
  /** e.g. "FY 2026-27" */
  label: string
  /** YYYY-MM-DD */
  start: string
  end: string
}

/** India's financial year (April to March) containing `date` (YYYY-MM-DD). */
export function financialYearOf(date: string): FinancialYear {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const startYear = month >= 4 ? year : year - 1
  const endShort = String((startYear + 1) % 100).padStart(2, "0")
  return {
    label: `FY ${startYear}-${endShort}`,
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  }
}

export type CryptoTaxEstimate = {
  year: FinancialYear
  saleCount: number
  /** Coins sold × sell price. */
  saleValue: number
  /** Gains of the sales that made money, before selling fees. */
  gains: number
  /** Losses of the other sales (a negative number); they don't reduce the tax. */
  losses: number
  /** 30% of gains plus 4% cess. */
  tax: number
  /** 1% of the sale value, usually deducted by the exchange. */
  tds: number
}

export function estimateCryptoTax(
  holdings: readonly { position: { sales: readonly Sale[] } }[],
  year: FinancialYear,
): CryptoTaxEstimate {
  let saleCount = 0
  let saleValue = 0
  let gains = 0
  let losses = 0

  for (const holding of holdings) {
    for (const sale of holding.position.sales) {
      if (sale.date < year.start || sale.date > year.end) continue
      const value = sale.quantity * sale.price
      const gain = value - sale.costBasis
      saleCount += 1
      saleValue += value
      if (gain > 0) gains += gain
      else losses += gain
    }
  }

  return {
    year,
    saleCount,
    saleValue,
    gains,
    losses,
    tax: gains * CRYPTO_TAX_RATE * (1 + CESS_RATE),
    tds: saleValue * TDS_RATE,
  }
}
