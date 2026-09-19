import { formatPercent } from "@/lib/format"

export type ShareRow = {
  key: string
  label: React.ReactNode
  /** Formatted amount on the right, e.g. "₹1,20,000". */
  value: string
  /** Share of the whole, in percent. */
  pct: number
  /** Small text under the bar. */
  detail?: React.ReactNode
  /** Bar colour; the theme's primary colour by default. */
  color?: string
}

/** Rows with an amount and a bar for their share, like "By asset type" on the dashboard. */
export function ShareList({
  rows,
  shareOf,
}: {
  rows: ShareRow[]
  /** For screen readers, e.g. "of the family's stocks". */
  shareOf: string
}) {
  return (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li key={row.key} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{row.label}</span>
            <span className="shrink-0 tabular-nums">{row.value}</span>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="h-2 flex-1 bg-primary/15"
              style={
                row.color
                  ? {
                      backgroundColor: `color-mix(in oklab, ${row.color} 15%, transparent)`,
                    }
                  : undefined
              }
              aria-hidden
            >
              <div
                className="h-full rounded-r-[4px] bg-primary"
                style={{
                  width: `${Math.min(100, Math.max(row.pct, 0.5))}%`,
                  ...(row.color ? { backgroundColor: row.color } : {}),
                }}
              />
            </div>
            <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
              {formatPercent(row.pct, { decimals: 0, signed: false })}
              <span className="sr-only"> {shareOf}</span>
            </span>
          </div>
          {row.detail && (
            <p className="text-xs text-muted-foreground">{row.detail}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
