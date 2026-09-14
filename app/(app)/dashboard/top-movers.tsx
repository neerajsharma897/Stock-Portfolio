import { toneTextClass } from "@/components/stat-tile"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { TransactionInstrument } from "@/lib/data/transactions"
import { formatINR, formatPercent } from "@/lib/format"
import type { Mover } from "@/lib/portfolio/valuation"
import { cn } from "@/lib/utils"

function MoverList({
  title,
  movers,
  instruments,
}: {
  title: string
  movers: Mover[]
  instruments: Map<number, TransactionInstrument>
}) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {movers.length === 0 ? (
        <p className="text-sm text-muted-foreground">None today</p>
      ) : (
        <ul className="grid gap-2">
          {movers.map((mover) => {
            const instrument = instruments.get(mover.instrumentId)
            return (
              <li
                key={mover.instrumentId}
                className="flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {instrument?.symbol ?? "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatINR(mover.lastPrice)}
                  </p>
                </div>
                <p
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    // Each list holds only risers or only fallers.
                    toneTextClass(mover.changePct > 0 ? "gain" : "loss"),
                  )}
                >
                  {formatPercent(mover.changePct)}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function TopMovers({
  movers,
  instruments,
}: {
  movers: { gainers: Mover[]; losers: Mover[] }
  instruments: Map<number, TransactionInstrument>
}) {
  const hasMovers = movers.gainers.length > 0 || movers.losers.length > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s movers</CardTitle>
        <CardDescription>
          Change since the previous close, for stocks the family holds.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {hasMovers ? (
          <>
            <MoverList
              title="Top gainers"
              movers={movers.gainers}
              instruments={instruments}
            />
            <MoverList
              title="Top losers"
              movers={movers.losers}
              instruments={instruments}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add a previous close when updating prices to see today&apos;s
            movers.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
