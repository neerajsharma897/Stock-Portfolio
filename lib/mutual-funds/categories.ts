// Mutual funds grouped by AMFI category, e.g. "Equity Scheme - Large Cap Fund"
// becomes group "Equity", category "Large Cap".

export type FundGroup =
  | "Equity"
  | "Debt"
  | "Hybrid"
  | "Index funds & ETFs"
  | "Fund of funds"
  | "Solution oriented"
  | "Other"

const SCHEME_GROUPS: [RegExp, FundGroup][] = [
  [/^equity scheme/i, "Equity"],
  [/^debt scheme/i, "Debt"],
  [/^hybrid scheme/i, "Hybrid"],
  [/^solution oriented scheme/i, "Solution oriented"],
]

// Older AMFI categories without the "... Scheme - " prefix.
const LEGACY_GROUPS: [RegExp, FundGroup][] = [
  [/^(growth|elss|equity)/i, "Equity"],
  [/^(income|gilt|money market|liquid|debt)/i, "Debt"],
  [/^(balanced|hybrid)/i, "Hybrid"],
]

function tidy(name: string) {
  return name
    .replace(/\s+/g, " ")
    .replace(/\s*funds?$/i, "")
    .trim()
}

export function fundCategory(category: string | null): {
  group: FundGroup
  name: string
} {
  if (!category?.trim()) return { group: "Other", name: "Other" }
  const [scheme, ...rest] = category.split(" - ")
  const detail = tidy(rest.join(" - ")) || tidy(scheme)

  for (const [pattern, group] of SCHEME_GROUPS) {
    if (pattern.test(scheme)) return { group, name: detail }
  }
  if (/^other scheme/i.test(scheme)) {
    if (/fof|fund of funds/i.test(detail)) {
      return { group: "Fund of funds", name: detail }
    }
    if (/index|etf/i.test(detail)) {
      return { group: "Index funds & ETFs", name: detail }
    }
    return { group: "Other", name: detail }
  }
  for (const [pattern, group] of LEGACY_GROUPS) {
    if (pattern.test(scheme)) return { group, name: tidy(scheme) }
  }
  return { group: "Other", name: tidy(scheme) }
}

export type CategorySlice = {
  name: string
  value: number
  /** Percent of all valued funds. */
  weightPct: number
}

export type GroupSlice = CategorySlice & { categories: CategorySlice[] }

/** Valued funds by group and category, largest first. */
export function categorySplit(
  funds: readonly { category: string | null; value: number | null }[],
): GroupSlice[] {
  const valued = funds.filter(
    (fund): fund is { category: string | null; value: number } =>
      fund.value !== null && fund.value > 0,
  )
  const total = valued.reduce((sum, fund) => sum + fund.value, 0)
  const pct = (value: number) => (total > 0 ? (value / total) * 100 : 0)

  const groups = new Map<FundGroup, Map<string, number>>()
  for (const fund of valued) {
    const { group, name } = fundCategory(fund.category)
    const categories = groups.get(group) ?? new Map<string, number>()
    categories.set(name, (categories.get(name) ?? 0) + fund.value)
    groups.set(group, categories)
  }

  return [...groups.entries()]
    .map(([name, categories]) => {
      const value = [...categories.values()].reduce((a, b) => a + b, 0)
      return {
        name,
        value,
        weightPct: pct(value),
        categories: [...categories.entries()]
          .map(([category, amount]) => ({
            name: category,
            value: amount,
            weightPct: pct(amount),
          }))
          .sort((a, b) => b.value - a.value),
      }
    })
    .sort((a, b) => b.value - a.value)
}
