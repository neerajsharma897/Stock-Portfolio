import { toneOf, toneTextClass } from "@/components/stat-tile"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { mirrorIndex } from "@/lib/benchmark/mirror"
import {
  BenchmarkUnavailableError,
  getNiftyCloses,
} from "@/lib/benchmark/nifty"
import {
  formatDate,
  formatINR,
  formatPercent,
  formatSignedINR,
} from "@/lib/format"
import type { CashFlow } from "@/lib/portfolio/xirr"
import { cn } from "@/lib/utils"

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stocks vs Nifty 50</CardTitle>
        <CardDescription>
          If the same money had gone into the Nifty 50 on the same days.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  )
}

export function NiftyComparisonSkeleton() {
  return (
    <Frame>
      <Skeleton className="h-24 w-full" />
    </Frame>
  )
}

function Side({
  title,
  value,
  gain,
  netInvested,
  xirr,
}: {
  title: string
  value: number
  gain: number
  netInvested: number
  xirr: number | null
}) {
  const tone = toneTextClass(toneOf(gain))
  return (
    <div className="grid content-start gap-0.5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-xl font-semibold tracking-tight tabular-nums">
        {formatINR(value, 0)}
      </p>
      <p className={cn("text-sm font-medium tabular-nums", tone)}>
        {formatSignedINR(gain, 0)}
        {netInvested > 0 && ` (${formatPercent((gain / netInvested) * 100)})`}
      </p>
      {xirr !== null && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatPercent(xirr * 100)} XIRR
        </p>
      )}
    </div>
  )
}

/** The family's stocks against the same cash flows put into the Nifty 50. */
export async function NiftyComparison({
  flows,
  stockValue,
  stockXirr,
  allPriced,
}: {
  /** Every stock buy (negative) and sell (positive), all members. */
  flows: CashFlow[]
  stockValue: number
  stockXirr: number | null
  allPriced: boolean
}) {
  if (flows.length === 0) return null
  if (!allPriced) {
    return (
      <Frame>
        <p className="text-sm text-muted-foreground">
          Some stocks have no price yet, so the comparison would be off. Update
          prices first.
        </p>
      </Frame>
    )
  }

  const from = flows.reduce(
    (earliest, flow) => (flow.date < earliest ? flow.date : earliest),
    flows[0].date,
  )
  let mirror
  try {
    mirror = mirrorIndex(flows, await getNiftyCloses(from))
  } catch (error) {
    return (
      <Frame>
        <p className="text-sm text-muted-foreground">
          {error instanceof BenchmarkUnavailableError
            ? error.message
            : `Couldn't load the Nifty 50 history from Angel One. ${error instanceof Error ? error.message : ""}`}
        </p>
      </Frame>
    )
  }
  if (!mirror) {
    return (
      <Frame>
        <p className="text-sm text-muted-foreground">
          Angel One sent no Nifty 50 history.
        </p>
      </Frame>
    )
  }

  const flowTotal = flows.reduce((sum, flow) => sum + flow.amount, 0)
  const stockGain = stockValue + flowTotal
  const difference = stockGain - mirror.gain

  return (
    <Frame>
      <p
        className={cn("text-sm font-medium", toneTextClass(toneOf(difference)))}
      >
        {difference >= 0
          ? `Ahead of the Nifty 50 by ${formatINR(difference, 0)}`
          : `Behind the Nifty 50 by ${formatINR(-difference, 0)}`}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Side
          title="Your stocks"
          value={stockValue}
          gain={stockGain}
          netInvested={mirror.netInvested}
          xirr={stockXirr}
        />
        <Side
          title="Same money in Nifty 50"
          value={mirror.value}
          gain={mirror.gain}
          netInvested={mirror.netInvested}
          xirr={stockXirr === null ? null : mirror.xirr}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Every buy counts as buying the Nifty 50 at that day&apos;s close, and
        every sell as selling it, using closes up to{" "}
        {formatDate(mirror.valuedOn)}. Dividends aren&apos;t included on either
        side, and opening balances count on the date they were entered.
      </p>
    </Frame>
  )
}
