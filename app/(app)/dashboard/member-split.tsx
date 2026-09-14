import Link from "next/link"

import { MemberAvatar } from "@/components/member-avatar"
import { toneOf, toneTextClass } from "@/components/stat-tile"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { MemberPortfolio } from "@/lib/data/portfolio"
import { formatINR, formatPercent } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Each member's current value, with a bar for their share of the family total. */
export function MemberSplit({
  members,
  familyValue,
}: {
  members: MemberPortfolio[]
  familyValue: number
}) {
  const rows = [...members].sort(
    (a, b) => b.summary.currentValue - a.summary.currentValue,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>By member</CardTitle>
        <CardDescription>
          Current value and share of the family total.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1">
          {rows.map(({ member, summary }) => {
            const hasValue = summary.pricedCount > 0
            const share =
              hasValue && familyValue > 0
                ? (summary.currentValue / familyValue) * 100
                : 0

            return (
              <li key={member.id}>
                <Link
                  href={`/members/${member.id}`}
                  className="-mx-2 grid gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <MemberAvatar name={member.name} color={member.color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {summary.holdingCount === 0
                          ? "No holdings"
                          : `${summary.holdingCount} ${summary.holdingCount === 1 ? "holding" : "holdings"} · ${formatINR(summary.invested, 0)} invested`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">
                        {hasValue ? formatINR(summary.currentValue, 0) : "—"}
                      </p>
                      {hasValue && summary.unrealizedPct !== null && (
                        <p
                          className={cn(
                            "text-xs font-medium tabular-nums",
                            toneTextClass(toneOf(summary.unrealizedPnl)),
                          )}
                        >
                          {formatPercent(summary.unrealizedPct)}
                          <span className="sr-only"> overall</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {hasValue && (
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 bg-primary/15" aria-hidden>
                        <div
                          className="h-full rounded-r-[4px] bg-primary"
                          style={{ width: `${Math.max(share, 0.5)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                        {formatPercent(share, { decimals: 0, signed: false })}
                        <span className="sr-only"> of family value</span>
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
