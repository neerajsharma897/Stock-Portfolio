import { FileSpreadsheetIcon, TriangleAlertIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { toneOf, toneTextClass } from "@/components/stat-tile"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { financialYearOf, type FinancialYear } from "@/lib/crypto/tax"
import { listGainLines, type MemberGains } from "@/lib/data/reports"
import { todayInIndia } from "@/lib/dates"
import {
  formatDate,
  formatINR,
  formatQuantity,
  formatSignedINR,
} from "@/lib/format"
import {
  GAIN_ASSET_LABELS,
  summarizeGains,
  type GainsSummary,
} from "@/lib/tax/capital-gains"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Tax reports" }

const YEARS_SHOWN = 5

function Chip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3 py-1 text-sm font-medium ring-1 ring-border transition-colors",
        active
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  )
}

function Amount({ value }: { value: number }) {
  return (
    <dd className={cn("text-right tabular-nums", toneTextClass(toneOf(value)))}>
      {formatSignedINR(value, 0)}
    </dd>
  )
}

function Totals({ summary }: { summary: GainsSummary }) {
  const { equity, goldBonds, otherFunds, crypto } = summary
  const hasGoldBonds = summary.lines.some((line) => line.asset === "gold_bond")
  const hasOtherFunds = summary.lines.some(
    (line) => line.asset === "other_fund",
  )
  const hasCrypto = summary.lines.some((line) => line.asset === "crypto")

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="grid gap-2" aria-label="Shares and equity funds">
        <h3 className="text-sm font-medium">Shares &amp; equity funds</h3>
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Short-term (up to 1 year)</dt>
          <Amount value={equity.shortTerm} />
          <dt className="text-muted-foreground">Long-term (over 1 year)</dt>
          <Amount value={equity.longTerm} />
          <dt className="text-muted-foreground">Tax-free long-term used</dt>
          <dd className="text-right tabular-nums">
            {formatINR(equity.exemption, 0)}
          </dd>
          <dt className="font-medium">Estimated tax</dt>
          <dd className="text-right font-medium tabular-nums">
            {formatINR(equity.tax, 0)}
          </dd>
        </dl>
      </section>

      {hasCrypto && (
        <section className="grid gap-2" aria-label="Crypto">
          <h3 className="text-sm font-medium">Crypto</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Gains</dt>
            <Amount value={crypto.gains} />
            <dt className="text-muted-foreground">
              Losses (can&apos;t be set off)
            </dt>
            <Amount value={crypto.losses} />
            <dt className="font-medium">Estimated tax (30% + cess)</dt>
            <dd className="text-right font-medium tabular-nums">
              {formatINR(crypto.tax, 0)}
            </dd>
            <dt className="text-muted-foreground">TDS at 1% (already paid)</dt>
            <dd className="text-right tabular-nums">
              {formatINR(crypto.tds, 0)}
            </dd>
          </dl>
        </section>
      )}

      {hasGoldBonds && (
        <section className="grid gap-2" aria-label="Gold bonds">
          <h3 className="text-sm font-medium">
            Gold bonds sold on the exchange
          </h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Short-term (at slab rate)</dt>
            <Amount value={goldBonds.shortTerm} />
            <dt className="text-muted-foreground">Long-term (12.5%)</dt>
            <Amount value={goldBonds.longTerm} />
          </dl>
        </section>
      )}

      {hasOtherFunds && (
        <section className="grid gap-2" aria-label="Other funds">
          <h3 className="text-sm font-medium">Debt &amp; other funds</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Held up to 2 years</dt>
            <Amount value={otherFunds.shortTerm} />
            <dt className="text-muted-foreground">Held over 2 years</dt>
            <Amount value={otherFunds.longTerm} />
          </dl>
          <p className="text-xs text-muted-foreground">
            Not estimated: debt funds bought after March 2023 are taxed at the
            slab rate however long they&apos;re held, and other funds have their
            own rules.
          </p>
        </section>
      )}
    </div>
  )
}

function SalesTable({ summary }: { summary: GainsSummary }) {
  return (
    <div className="relative -mx-4 overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2 font-medium">
              Sold
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              What
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Quantity
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Sale value
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Cost
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Gain
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {summary.lines.map((line, index) => (
            <tr key={`${line.saleDate}:${line.name}:${line.term}:${index}`}>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {formatDate(line.saleDate)}
              </td>
              <td className="max-w-72 px-4 py-2.5">
                <div className="font-medium">{line.name}</div>
                <div className="text-xs text-muted-foreground">
                  {GAIN_ASSET_LABELS[line.asset]}
                  {line.term === "short" && " · short-term"}
                  {line.term === "long" && " · long-term"} · bought{" "}
                  {line.boughtFrom === line.boughtTo
                    ? formatDate(line.boughtFrom)
                    : `${formatDate(line.boughtFrom)} to ${formatDate(line.boughtTo)}`}
                  {line.estimated && " · ≈ from an opening balance"}
                </div>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatQuantity(line.quantity)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatINR(line.saleValue, 0)}
                {line.expenses > 0 && (
                  <div className="text-xs text-muted-foreground">
                    − {formatINR(line.expenses, 0)} charges
                  </div>
                )}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {formatINR(line.cost, 0)}
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right font-medium tabular-nums",
                  toneTextClass(toneOf(line.gain)),
                )}
              >
                {formatSignedINR(line.gain, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function availableYears(members: MemberGains[], current: FinancialYear) {
  const currentStart = Number(current.start.slice(0, 4))
  const starts = new Set<number>()
  for (let year = currentStart; year > currentStart - YEARS_SHOWN; year--) {
    starts.add(year)
  }
  for (const { lines } of members) {
    for (const line of lines) {
      starts.add(Number(financialYearOf(line.saleDate).start.slice(0, 4)))
    }
  }
  return [...starts].sort((a, b) => b - a)
}

export default async function ReportsPage({
  searchParams,
}: PageProps<"/reports">) {
  const { fy, member: memberParam } = await searchParams
  const members = await listGainLines()
  const current = financialYearOf(todayInIndia())
  const years = availableYears(members, current)
  const startYear =
    typeof fy === "string" && years.includes(Number(fy))
      ? Number(fy)
      : Number(current.start.slice(0, 4))
  const year = financialYearOf(`${startYear}-04-01`)
  const selected =
    typeof memberParam === "string"
      ? (members.find(({ member }) => member.id === memberParam) ?? null)
      : null
  const shown = selected ? [selected] : members
  const link = (params: { fy?: number; member?: string | null }) => {
    const query = new URLSearchParams()
    query.set("fy", String(params.fy ?? startYear))
    const memberId =
      params.member === undefined ? selected?.member.id : params.member
    if (memberId) query.set("member", memberId)
    return `/reports?${query}`
  }
  const problems = shown.reduce((sum, { problems }) => sum + problems, 0)

  return (
    <>
      <PageHeader
        title="Tax reports"
        description="Capital gains per member and financial year, for the income tax return."
      >
        <Button asChild variant="outline" size="sm">
          <a href={`/api/export/excel?fy=${startYear}`} download>
            <FileSpreadsheetIcon />
            Download Excel
          </a>
        </Button>
      </PageHeader>

      <nav aria-label="Financial year" className="mb-2 flex flex-wrap gap-1.5">
        {years.map((start) => (
          <Chip
            key={start}
            href={link({ fy: start })}
            active={start === startYear}
          >
            {financialYearOf(`${start}-04-01`).label}
          </Chip>
        ))}
      </nav>
      <nav aria-label="Member" className="mb-2 flex flex-wrap gap-1.5">
        <Chip href={link({ member: null })} active={!selected}>
          Everyone
        </Chip>
        {members.map(({ member }) => (
          <Chip
            key={member.id}
            href={link({ member: member.id })}
            active={selected?.member.id === member.id}
          >
            {member.name}
          </Chip>
        ))}
      </nav>

      {problems > 0 && (
        <div
          role="alert"
          className="mb-2 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
        >
          <TriangleAlertIcon
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden
          />
          <p>
            Some entries don&apos;t add up, so their sells are missing here. Fix
            them on the member&apos;s page first.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        {shown.map(({ member, lines }) => {
          const summary = summarizeGains(lines, year)
          return (
            <Card key={member.id}>
              <CardHeader>
                <CardTitle>
                  {member.name} · {year.label}
                </CardTitle>
                <CardDescription>
                  {summary.lines.length === 0
                    ? "No sells or redemptions this financial year."
                    : `${summary.lines.length} ${summary.lines.length === 1 ? "part" : "parts"} of sells, split by how long the shares were held.`}
                </CardDescription>
              </CardHeader>
              {summary.lines.length > 0 && (
                <CardContent className="grid gap-5">
                  <Totals summary={summary} />
                  <SalesTable summary={summary} />
                </CardContent>
              )}
            </Card>
          )
        })}

        <Card>
          <CardContent className="grid gap-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">About these numbers</p>
            <p>
              Estimates to help fill in the return, not tax advice. Sells are
              matched with the oldest shares first. Shares and equity funds: 20%
              short-term and 12.5% long-term above ₹1.25 lakh a year (15% and
              10% above ₹1 lakh for sales before 23 July 2024), plus 4% cess.
              Surcharge, grandfathering of shares bought before February 2018,
              losses carried forward, dividends and interest aren&apos;t
              included.
            </p>
            <p>
              Shares from an opening balance use its date and average price, so
              their holding period and cost are approximate (marked ≈).
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
