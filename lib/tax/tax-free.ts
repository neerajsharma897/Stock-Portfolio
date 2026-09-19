// How much of a person's yearly tax-free long-term gain (₹1.25 lakh on listed
// shares and equity funds together) is used, and how much of their current
// long-term gains could still be booked without tax this financial year.

import type { FinancialYear } from "@/lib/crypto/tax"
import {
  longTermExemption,
  summarizeGains,
  type GainLine,
} from "@/lib/tax/capital-gains"

export type TaxFreeRoom = {
  limit: number
  /** Taken up by long-term gains already booked this year (after setting off losses). */
  used: number
  left: number
  /** Unrealised long-term gain on shares and equity funds held now, net of losses. */
  longTermGain: number
  /** Part of that gain that fits in what's left. */
  bookable: number
}

export function taxFreeRoom(
  lines: readonly GainLine[],
  year: FinancialYear,
  longTermGain: number,
): TaxFreeRoom {
  const limit = longTermExemption(year)
  const used = summarizeGains(lines, year).equity.exemption
  const left = Math.max(0, limit - used)
  return {
    limit,
    used,
    left,
    longTermGain,
    bookable: Math.min(left, Math.max(0, longTermGain)),
  }
}
