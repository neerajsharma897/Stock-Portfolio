import Link from "next/link"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AssetClass } from "@/lib/data/portfolio"
import { formatINR, formatPercent } from "@/lib/format"

/** Current value per asset type, with a bar for its share of the family total. */
export function AssetSplit({
  assetClasses,
  familyValue,
}: {
  assetClasses: AssetClass[]
  familyValue: number
}) {
  const rows = assetClasses
    .filter(({ summary }) => summary.holdingCount > 0)
    .sort((a, b) => b.summary.currentValue - a.summary.currentValue)
  if (rows.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>By asset type</CardTitle>
        <CardDescription>Current value and share of the total.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {rows.map(({ key, label, href, summary }) => {
            const share =
              familyValue > 0 ? (summary.currentValue / familyValue) * 100 : 0
            const name = href ? (
              <Link href={href} className="font-medium hover:underline">
                {label}
              </Link>
            ) : (
              <span className="font-medium">{label}</span>
            )
            return (
              <li key={key} className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  {name}
                  <span className="tabular-nums">
                    {summary.pricedCount > 0
                      ? formatINR(summary.currentValue, 0)
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 bg-primary/15" aria-hidden>
                    <div
                      className="h-full rounded-r-[4px] bg-primary"
                      style={{ width: `${Math.max(share, 0.5)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                    {formatPercent(share, { decimals: 0, signed: false })}
                    <span className="sr-only"> of the family total</span>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
