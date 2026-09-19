// The daily market-close summary sent to Telegram.

import { formatCompactINR, formatPercent, formatSignedINR } from "@/lib/format"
import type { Mover, PortfolioSummary } from "@/lib/portfolio/valuation"
import { escapeHtml } from "@/lib/telegram/format"

const dayFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
})

function changeText(summary: PortfolioSummary) {
  return summary.dayChangePct === null
    ? ""
    : ` ${formatPercent(summary.dayChangePct)}`
}

export function dailySummaryMessage({
  now,
  family,
  members,
  movers,
  symbolOf,
}: {
  now: Date
  family: PortfolioSummary
  members: readonly { name: string; summary: PortfolioSummary }[]
  movers: { gainers: Mover[]; losers: Mover[] }
  symbolOf: (instrumentId: number) => string
}): string {
  const lines = [`📅 <b>Market close, ${dayFormat.format(now)}</b>`]
  const today =
    family.dayChangePct === null
      ? ""
      : ` (${formatSignedINR(family.dayChange, 0)}, ${formatPercent(family.dayChangePct)} today)`
  lines.push(
    `Family: <b>${formatCompactINR(family.currentValue)}</b>${today}`,
    "",
  )

  for (const { name, summary } of members) {
    if (summary.holdingCount === 0) continue
    lines.push(
      `${escapeHtml(name)}: ${formatCompactINR(summary.currentValue)}${changeText(summary)}`,
    )
  }

  const gainer = movers.gainers[0]
  const loser = movers.losers[0]
  if (gainer || loser) lines.push("")
  if (gainer) {
    lines.push(
      `🟢 Top gainer: ${escapeHtml(symbolOf(gainer.instrumentId))} ${formatPercent(gainer.changePct)}`,
    )
  }
  if (loser) {
    lines.push(
      `🔴 Top loser: ${escapeHtml(symbolOf(loser.instrumentId))} ${formatPercent(loser.changePct)}`,
    )
  }
  lines.push(
    "",
    "Today's change counts stocks; funds and crypto move on their own clocks.",
  )
  return lines.join("\n")
}
