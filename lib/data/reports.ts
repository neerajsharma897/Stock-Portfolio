import "server-only"

import { getFamilyPortfolio, type FamilyPortfolio } from "@/lib/data/portfolio"
import { fundTaxClass, gainLines, type GainLine } from "@/lib/tax/capital-gains"

export type MemberGains = {
  member: FamilyPortfolio["members"][number]["member"]
  /** Every part of every sell, oldest first. */
  lines: GainLine[]
  /** Holdings whose entries don't add up; their sells are missing. */
  problems: number
}

/** Each active member's sells split into gain lines, from the family portfolio. */
export function buildGainLines(portfolio: FamilyPortfolio): MemberGains[] {
  const { instruments, schemes, coins } = portfolio
  return portfolio.members.map((memberPortfolio) => {
    const { member } = memberPortfolio
    const lines = [
      ...memberPortfolio.holdings.flatMap((holding) => {
        const instrument = instruments.get(holding.instrumentId)
        return holding.position.sales.flatMap((sale) =>
          gainLines(sale, {
            asset: instrument?.kind === "sgb" ? "gold_bond" : "equity",
            name: instrument?.symbol ?? "Unknown stock",
            memberId: member.id,
          }),
        )
      }),
      ...memberPortfolio.funds.flatMap((fund) => {
        const scheme = schemes.get(fund.amfiCode)
        return fund.position.sales.flatMap((sale) =>
          gainLines(sale, {
            asset: fundTaxClass(scheme?.category ?? null, scheme?.name ?? ""),
            name: scheme?.name ?? "Unknown fund",
            memberId: member.id,
          }),
        )
      }),
      ...memberPortfolio.crypto.flatMap((holding) =>
        holding.position.sales.flatMap((sale) =>
          gainLines(sale, {
            asset: "crypto",
            name: coins.get(holding.market)?.symbol ?? holding.market,
            memberId: member.id,
          }),
        ),
      ),
    ].sort((a, b) => a.saleDate.localeCompare(b.saleDate))

    return {
      member,
      lines,
      problems:
        memberPortfolio.problems.length +
        memberPortfolio.fundProblems.length +
        memberPortfolio.cryptoProblems.length,
    }
  })
}

/** Every active member's gain lines. */
export async function listGainLines(): Promise<MemberGains[]> {
  return buildGainLines(await getFamilyPortfolio())
}
