import { TriangleAlertIcon } from "lucide-react"

import {
  SetSectorDialog,
  UpdateSectorsButton,
} from "@/app/(app)/stocks/sector-buttons"
import { ShareList } from "@/components/share-list"
import { toneOf, toneTextClass } from "@/components/stat-tile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { BrokerSplitRow } from "@/lib/data/stock-insights"
import type { TransactionInstrument } from "@/lib/data/transactions"
import {
  formatCompactINR,
  formatDate,
  formatINR,
  formatPercent,
  formatQuantity,
  formatSignedINR,
} from "@/lib/format"
import {
  HEAVY_STOCK_PCT,
  UNCLASSIFIED,
  type Concentration,
  type HoldingTerms,
  type MonthFlow,
  type Slice,
} from "@/lib/portfolio/insights"
import type { TaxFreeRoom } from "@/lib/tax/tax-free"
import { cn } from "@/lib/utils"

type Instruments = Map<number, TransactionInstrument>
type Member = { id: string; name: string; color: string }

const symbolOf = (instruments: Instruments, instrumentId: number) =>
  instruments.get(instrumentId)?.symbol ?? "Unknown"

// Sectors -------------------------------------------------------------------

export function SectorCard({
  slices,
  instruments,
  loaded,
  missing,
}: {
  slices: Slice[]
  instruments: Instruments
  loaded: boolean
  /** The sectors migration hasn't been run. */
  missing: boolean
}) {
  if (missing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>By sector</CardTitle>
          <CardDescription>
            Run supabase/migrations/20260921090000_stock_sectors.sql in the
            Supabase SQL Editor to group stocks by sector.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }
  const unclassified = slices.find((slice) => slice.label === UNCLASSIFIED)
  return (
    <Card>
      <CardHeader>
        <CardTitle>By sector</CardTitle>
        <CardDescription>
          {loaded
            ? "From NSE's industry list, updated weekly."
            : "Download NSE's industry list to group stocks by sector."}
        </CardDescription>
        <CardAction>
          <UpdateSectorsButton loaded={loaded} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {slices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sectors show once stocks have prices.
          </p>
        ) : (
          <ShareList
            shareOf="of the family's stocks"
            rows={slices.map((slice) => ({
              key: slice.label,
              label: slice.label,
              value: formatINR(slice.value, 0),
              pct: slice.weightPct,
              detail: slice.instrumentIds
                .map((id) => symbolOf(instruments, id))
                .join(", "),
              color:
                slice.label === UNCLASSIFIED
                  ? "var(--muted-foreground)"
                  : undefined,
            }))}
          />
        )}
        {loaded && unclassified && (
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">
              Not in NSE&apos;s list (smaller companies, ETFs or BSE-only
              stocks). Set their sector:
            </p>
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {unclassified.instrumentIds.map((id) => (
                <li key={id} className="flex items-center gap-0.5">
                  <span className="font-medium">
                    {symbolOf(instruments, id)}
                  </span>
                  <SetSectorDialog
                    symbol={symbolOf(instruments, id)}
                    sector={null}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Concentration ---------------------------------------------------------------

export function ConcentrationCard({
  concentration,
  instruments,
}: {
  concentration: Concentration
  instruments: Instruments
}) {
  const { count, largest, top5Pct, effectiveCount, heavy } = concentration
  return (
    <Card>
      <CardHeader>
        <CardTitle>Concentration</CardTitle>
        <CardDescription>How spread out the stocks are.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {count === 0 || !largest ? (
          <p className="text-sm text-muted-foreground">
            Shows once stocks have prices.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Largest stock</dt>
              <dd className="text-right tabular-nums">
                {symbolOf(instruments, largest.instrumentId)}{" "}
                {formatPercent(largest.weightPct, { signed: false })}
              </dd>
              <dt className="text-muted-foreground">
                Top {Math.min(5, count)} {count === 1 ? "stock" : "stocks"}
              </dt>
              <dd className="text-right tabular-nums">
                {formatPercent(top5Pct, { signed: false })}
              </dd>
              <dt className="text-muted-foreground">
                Spread like
                <span className="block text-xs">
                  equal-sized stocks, out of {count}
                </span>
              </dt>
              <dd className="text-right tabular-nums">
                {effectiveCount.toFixed(1)}
              </dd>
            </dl>
            {heavy.length > 0 ? (
              <div
                role="note"
                className="flex gap-2 rounded-lg border border-loss/30 bg-loss/5 p-3 text-sm"
              >
                <TriangleAlertIcon
                  className="mt-0.5 size-4 shrink-0 text-loss"
                  aria-hidden
                />
                <p>
                  {heavy
                    .map(
                      (stock) =>
                        `${symbolOf(instruments, stock.instrumentId)} (${formatPercent(stock.weightPct, { decimals: 0, signed: false })})`,
                    )
                    .join(", ")}{" "}
                  {heavy.length === 1 ? "is" : "are each"} more than{" "}
                  {HEAVY_STOCK_PCT}% of the family&apos;s stocks, so a fall
                  there moves the whole portfolio.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No single stock is more than {HEAVY_STOCK_PCT}% of the total.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Brokers ---------------------------------------------------------------------

export function BrokerCard({ rows }: { rows: BrokerSplitRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>By broker</CardTitle>
        <CardDescription>Where the shares are held.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Shows once stocks have prices.
          </p>
        ) : (
          <ShareList
            shareOf="of the family's stocks"
            rows={rows.map((row) => ({
              key: row.broker,
              label: row.label,
              value: formatINR(row.value, 0),
              pct: row.pct,
              detail: `${row.memberNames.join(", ")} · ${row.accountCount} ${row.accountCount === 1 ? "account" : "accounts"}`,
            }))}
          />
        )}
      </CardContent>
    </Card>
  )
}

// Holding periods -------------------------------------------------------------

export function HoldingTermsCard({
  terms,
  instruments,
  membersById,
}: {
  terms: HoldingTerms
  instruments: Instruments
  membersById: Map<string, Member>
}) {
  const total = terms.longTerm.value + terms.shortTerm.value
  const longPct = total > 0 ? (terms.longTerm.value / total) * 100 : 0
  const parts = [
    { label: "Long-term (over a year)", part: terms.longTerm, pct: longPct },
    {
      label: "Short-term (a year or less)",
      part: terms.shortTerm,
      pct: total > 0 ? 100 - longPct : 0,
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Short- and long-term</CardTitle>
        <CardDescription>
          Shares held over 12 months are long-term: their gains are taxed at
          12.5% above ₹1.25 lakh a year, instead of 20%.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Shows once stocks have prices.
          </p>
        ) : (
          <>
            <ShareList
              shareOf="of the family's stocks"
              rows={parts.map(({ label, part, pct }) => ({
                key: label,
                label,
                value: formatINR(part.value, 0),
                pct,
                detail: (
                  <span className={toneTextClass(toneOf(part.gain))}>
                    {formatSignedINR(part.gain, 0)} unrealised
                  </span>
                ),
              }))}
            />
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">
                Turning long-term in the next 60 days
              </h3>
              {terms.soon.length === 0 ? (
                <p className="text-sm text-muted-foreground">None.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {terms.soon.map((row) => (
                    <li
                      key={`${row.memberId}:${row.instrumentId}:${row.longTermOn}`}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="font-medium">
                          {symbolOf(instruments, row.instrumentId)}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          · {membersById.get(row.memberId)?.name} ·{" "}
                          {formatQuantity(row.quantity)} shares
                        </span>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <div>from {formatDate(row.longTermOn)}</div>
                        <div
                          className={cn(
                            "text-xs",
                            toneTextClass(toneOf(row.gain)),
                          )}
                        >
                          {formatSignedINR(row.gain, 0)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Selling these before the date counts as short-term.
                {terms.estimated &&
                  " Opening balances use the date they were entered, which may not be the real purchase date."}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// Tax-free long-term gains ----------------------------------------------------------

export function TaxFreeCard({
  rows,
  yearLabel,
}: {
  rows: { member: Member; room: TaxFreeRoom }[]
  yearLabel: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax-free gains, {yearLabel}</CardTitle>
        <CardDescription>
          Each person&apos;s first ₹1.25 lakh of long-term gains on shares and
          equity funds each year is tax-free.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No long-term gains booked or held yet.
          </p>
        ) : (
          <ShareList
            shareOf="of the tax-free limit used"
            rows={rows.map(({ member, room }) => ({
              key: member.id,
              label: member.name,
              value: `${formatCompactINR(room.used)} of ${formatCompactINR(room.limit)} used`,
              pct: room.limit > 0 ? (room.used / room.limit) * 100 : 0,
              color: member.color,
              detail:
                room.longTermGain > 0
                  ? `${formatINR(room.longTermGain, 0)} long-term gain held now; up to ${formatINR(room.bookable, 0)} of it could be booked tax-free this year.`
                  : room.longTermGain < 0
                    ? `Long-term holdings are ${formatINR(-room.longTermGain, 0)} down.`
                    : "No long-term holdings yet.",
            }))}
          />
        )}
        <p className="text-xs text-muted-foreground">
          Counts gains already booked this financial year (after setting off
          losses) and today&apos;s prices. A guide for planning, not tax advice.
        </p>
      </CardContent>
    </Card>
  )
}

// Money put in each month ------------------------------------------------------

const monthLabel = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
})
const labelOf = (month: string) =>
  monthLabel.format(new Date(`${month}-01T00:00:00Z`))

const CHART_HEIGHT = 160
const MIN_MONTHS_SHOWN = 12

export function MonthlyFlowsCard({
  months: allMonths,
}: {
  months: MonthFlow[]
}) {
  // Skip the empty months before the first entry, but show at least a year.
  const firstActive = allMonths.findIndex(
    (row) => row.putIn > 0 || row.takenOut > 0,
  )
  const months = allMonths.slice(
    Math.max(
      0,
      Math.min(
        firstActive < 0 ? allMonths.length : firstActive,
        allMonths.length - MIN_MONTHS_SHOWN,
      ),
    ),
  )
  const maxIn = Math.max(0, ...months.map((row) => row.putIn))
  const maxOut = Math.max(0, ...months.map((row) => row.takenOut))
  const scale = maxIn + maxOut > 0 ? CHART_HEIGHT / (maxIn + maxOut) : 0
  const lastYear = allMonths.slice(-12)
  const putIn = lastYear.reduce((sum, row) => sum + row.putIn, 0)
  const takenOut = lastYear.reduce((sum, row) => sum + row.takenOut, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Money put in each month</CardTitle>
        <CardDescription>
          Last 12 months: {formatINR(putIn, 0)} put into stocks,{" "}
          {formatINR(takenOut, 0)} taken out. Opening balances count in the
          month they were entered.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {scale === 0 ? (
          <p className="text-sm text-muted-foreground">
            No buys or sells in these months.
          </p>
        ) : (
          <>
            <div className="grid gap-1" aria-hidden>
              <div className="flex gap-1" style={{ height: maxIn * scale }}>
                {months.map((row) => (
                  <div
                    key={row.month}
                    className="flex flex-1 items-end"
                    title={`${labelOf(row.month)}: ${formatINR(row.putIn, 0)} put in, ${formatINR(row.takenOut, 0)} taken out`}
                  >
                    <div
                      className="w-full rounded-t-[3px] bg-primary"
                      style={{ height: row.putIn * scale }}
                    />
                  </div>
                ))}
              </div>
              {maxOut > 0 && (
                <div
                  className="flex gap-1 border-t"
                  style={{ height: maxOut * scale }}
                >
                  {months.map((row) => (
                    <div key={row.month} className="flex flex-1 items-start">
                      <div
                        className="w-full rounded-b-[3px] bg-gain"
                        style={{ height: row.takenOut * scale }}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-1 text-[10px] text-muted-foreground">
                {months.map((row, index) => (
                  <div key={row.month} className="flex-1 overflow-visible">
                    {index % 3 === 0 && (
                      <span className="whitespace-nowrap">
                        {labelOf(row.month)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-primary" /> Put in
                (buys)
              </span>
              {maxOut > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-gain" /> Taken out
                  (sells)
                </span>
              )}
            </div>
            <table className="sr-only">
              <caption>Money put into and taken out of stocks by month</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Put in</th>
                  <th scope="col">Taken out</th>
                </tr>
              </thead>
              <tbody>
                {months.map((row) => (
                  <tr key={row.month}>
                    <th scope="row">{labelOf(row.month)}</th>
                    <td>{formatINR(row.putIn, 0)}</td>
                    <td>{formatINR(row.takenOut, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </CardContent>
    </Card>
  )
}
