import type { Metadata } from "next"
import { unstable_rethrow } from "next/navigation"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { BackupCard } from "@/app/(app)/settings/backup-card"
import { DeleteHolidayButton } from "@/app/(app)/settings/delete-holiday-button"
import { HolidayForm } from "@/app/(app)/settings/holiday-form"
import { UpdateFundListButton } from "@/app/(app)/settings/update-fund-list-button"
import { UpdateStockListButton } from "@/app/(app)/settings/update-stock-list-button"
import { ComingSoon } from "@/components/coming-soon"
import { PageHeader } from "@/components/layout/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireUser } from "@/lib/auth"
import { listMarketHolidays, type MarketHoliday } from "@/lib/data/holidays"
import {
  getStockListStatus,
  type StockListStatus,
} from "@/lib/data/instruments"
import { listLatestJobRuns, type JobRun } from "@/lib/data/jobs"
import { getFundListStatus, type FundListStatus } from "@/lib/data/mutual-funds"
import { todayInIndia } from "@/lib/dates"
import { formatDate, formatQuantity } from "@/lib/format"
import { JOB_NAMES, JOBS, type JobName } from "@/lib/jobs/names"
import { getLiveStatus } from "@/lib/prices/live"
import { describeLiveStatus, type LiveStatus } from "@/lib/prices/live-status"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Settings" }

// A run still "running" after this long was stopped by the platform's time limit.
const STALLED_RUN_MS = 15 * 60_000

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
})

function StatusRow({
  ok,
  label,
  detail,
}: {
  ok: boolean
  label: string
  detail?: string
}) {
  const Icon = ok ? CircleCheckIcon : CircleAlertIcon
  return (
    <div className="flex gap-3">
      <Icon
        className={ok ? "size-5 text-gain" : "size-5 text-destructive"}
        aria-hidden
      />
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">
          {label}
          <span className="sr-only">{ok ? " (OK)" : " (needs attention)"}</span>
        </span>
        {detail && (
          <span className="text-sm text-muted-foreground">{detail}</span>
        )}
      </div>
    </div>
  )
}

/** Runs a loader, turning real failures into a message but letting Next.js redirects through. */
async function attempt<T>(
  load: () => Promise<T>,
): Promise<{ value: T } | { error: string }> {
  try {
    return { value: await load() }
  } catch (error) {
    unstable_rethrow(error)
    return { error: error instanceof Error ? error.message : "Unknown error" }
  }
}

function LivePricesCard({ status }: { status: LiveStatus }) {
  const badge = describeLiveStatus(status)
  return (
    <div className="grid gap-4">
      <StatusRow
        ok={status.configured}
        label={
          status.configured
            ? "Angel One settings found"
            : "Angel One settings missing"
        }
        detail={
          status.configured
            ? undefined
            : "Add ANGELONE_API_KEY, ANGELONE_CLIENT_CODE, ANGELONE_PIN and ANGELONE_TOTP_SECRET to .env.local, then restart the app. See README."
        }
      />
      {status.configured && (
        <StatusRow
          ok={!status.error}
          label={
            status.error
              ? "Last fetch failed"
              : status.lastFetchedAt
                ? "Fetching prices"
                : "No prices fetched yet"
          }
          detail={
            status.error ??
            (status.lastFetchedAt
              ? undefined
              : "Open the dashboard; prices are fetched while it's open.")
          }
        />
      )}
      <p className="text-sm text-muted-foreground">
        {badge.tone === "live" ? "Market open" : badge.label}
        {badge.tone !== "manual" && badge.tone !== "error" && badge.detail
          ? ` · ${badge.detail}`
          : ""}
        . Prices refresh every 5 seconds during market hours (Mon–Fri, 9:15
        AM–3:30 PM India time) while the dashboard or a member page is open.
      </p>
    </div>
  )
}

function describeJobRun(run: JobRun): {
  ok: boolean
  label: string
  detail: string
} {
  const when = dateTimeFormatter.format(new Date(run.startedAt))
  const stalled =
    run.status === "running" &&
    Date.now() - new Date(run.startedAt).getTime() > STALLED_RUN_MS

  if (stalled) {
    return {
      ok: false,
      label: "didn't finish",
      detail: `Started ${when} and was stopped before finishing.`,
    }
  }
  const labels: Record<JobRun["status"], string> = {
    running: "running now",
    success: "succeeded",
    skipped: "skipped",
    failed: "failed",
  }
  const text = [run.summary, run.error].filter(Boolean).join(" · ")
  return {
    ok: run.status !== "failed",
    label: labels[run.status],
    detail: text ? `${when} · ${text}` : when,
  }
}

function JobsCard({ runs }: { runs: Record<JobName, JobRun | null> }) {
  return (
    <div className="grid gap-4">
      {JOB_NAMES.map((job) => {
        const run = runs[job]
        const { label, schedule } = JOBS[job]
        if (!run) {
          return (
            <StatusRow
              key={job}
              ok
              label={`${label}: not run yet`}
              detail={`${schedule}. Runs only on the deployed site.`}
            />
          )
        }
        const described = describeJobRun(run)
        return (
          <StatusRow
            key={job}
            ok={described.ok}
            label={`${label}: ${described.label}`}
            detail={described.detail}
          />
        )
      })}
    </div>
  )
}

function HolidayList({ holidays }: { holidays: MarketHoliday[] }) {
  if (holidays.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No upcoming holidays listed. Add this year&apos;s trading holidays from
        the NSE website so live prices pause on those days.
      </p>
    )
  }
  return (
    <ul className="divide-y text-sm">
      {holidays.map((holiday) => {
        const label = `${formatDate(holiday.date)}, ${holiday.description}`
        return (
          <li
            key={holiday.date}
            className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
          >
            <span>
              <span className="font-medium tabular-nums">
                {formatDate(holiday.date)}
              </span>
              <span className="text-muted-foreground">
                {" "}
                · {holiday.description}
              </span>
            </span>
            <DeleteHolidayButton date={holiday.date} label={label} />
          </li>
        )
      })}
    </ul>
  )
}

export default async function SettingsPage() {
  const user = await requireUser()
  const supabase = await createClient()
  const [
    { data: owner, error },
    stockList,
    fundList,
    liveStatus,
    holidays,
    jobRuns,
  ] = await Promise.all([
    supabase
      .from("app_owner")
      .select("display_name, timezone, created_at")
      .maybeSingle(),
    attempt<StockListStatus>(getStockListStatus),
    attempt<FundListStatus>(getFundListStatus),
    attempt<LiveStatus>(getLiveStatus),
    attempt<MarketHoliday[]>(() =>
      listMarketHolidays({ from: todayInIndia() }),
    ),
    attempt(listLatestJobRuns),
  ])

  return (
    <>
      <PageHeader title="Settings" description="Account and setup status." />

      <div className="grid gap-2 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              You are the only user of this app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate">{user.email}</dd>
              <dt className="text-muted-foreground">Name</dt>
              <dd>{owner?.display_name ?? "—"}</dd>
              <dt className="text-muted-foreground">Timezone</dt>
              <dd>{owner?.timezone ?? "—"}</dd>
              <dt className="text-muted-foreground">Owner since</dt>
              <dd>{owner ? formatDate(owner.created_at) : "—"}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Setup status</CardTitle>
            <CardDescription>
              Checks that the database is set up correctly.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <StatusRow ok label="Signed in with Supabase" />
            <StatusRow
              ok={!error}
              label="Database migration applied"
              detail={
                error
                  ? `Run the Stage 1 migration (see README). Error: ${error.message}`
                  : undefined
              }
            />
            <StatusRow
              ok={!!owner}
              label="Owner account linked"
              detail={
                !error && !owner
                  ? "This account isn't the owner. The first account created in Supabase becomes the owner."
                  : undefined
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock list</CardTitle>
            <CardDescription>
              NSE and BSE shares and gold bonds from Angel One&apos;s public
              instrument file. Used to pick stocks when adding transactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {"error" in stockList ? (
              <StatusRow
                ok={false}
                label="Stock list unavailable"
                detail={`Run the stock list migration (see README). ${stockList.error}`}
              />
            ) : (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Stocks & gold bonds</dt>
                  <dd>
                    {stockList.value.count > 0
                      ? formatQuantity(stockList.value.count)
                      : "None yet"}
                  </dd>
                  <dt className="text-muted-foreground">Last updated</dt>
                  <dd>
                    {stockList.value.lastUpdated
                      ? formatDate(stockList.value.lastUpdated)
                      : "Never"}
                  </dd>
                </dl>
                <UpdateStockListButton hasList={stockList.value.count > 0} />
                <p className="text-sm text-muted-foreground">
                  {stockList.value.count > 0
                    ? "Updated automatically every Monday once the app is deployed, or update now."
                    : "Download the list once before adding transactions. It takes up to a minute."}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mutual fund list</CardTitle>
            <CardDescription>
              Every fund with its latest NAV from AMFI&apos;s public NAV file.
              Used to pick funds and value them.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {"error" in fundList ? (
              <StatusRow
                ok={false}
                label="Fund list unavailable"
                detail={`Run the mutual funds migration (see README). ${fundList.error}`}
              />
            ) : (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Open funds</dt>
                  <dd>
                    {fundList.value.count > 0
                      ? formatQuantity(fundList.value.count)
                      : "None yet"}
                  </dd>
                  <dt className="text-muted-foreground">Latest NAV date</dt>
                  <dd>
                    {fundList.value.latestNavDate
                      ? formatDate(fundList.value.latestNavDate)
                      : "—"}
                  </dd>
                  <dt className="text-muted-foreground">Last updated</dt>
                  <dd>
                    {fundList.value.lastUpdated
                      ? formatDate(fundList.value.lastUpdated)
                      : "Never"}
                  </dd>
                </dl>
                <UpdateFundListButton hasList={fundList.value.count > 0} />
                <p className="text-sm text-muted-foreground">
                  {fundList.value.count > 0
                    ? "NAVs update automatically every weekday night once the app is deployed, or update now."
                    : "Download the list once before adding mutual funds. It takes under a minute."}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live prices</CardTitle>
            <CardDescription>
              Latest prices from Angel One SmartAPI. Without it, enter prices by
              hand on the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {"error" in liveStatus ? (
              <StatusRow
                ok={false}
                label="Live prices unavailable"
                detail={liveStatus.error}
              />
            ) : (
              <LivePricesCard status={liveStatus.value} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scheduled jobs</CardTitle>
            <CardDescription>
              Automatic tasks on the deployed site: daily portfolio snapshots,
              nightly mutual fund NAVs and the weekly stock list update.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {"error" in jobRuns ? (
              <StatusRow
                ok={false}
                label="Job history unavailable"
                detail={`Run the scheduled jobs migration (see README). ${jobRuns.error}`}
              />
            ) : (
              <JobsCard runs={jobRuns.value} />
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Backup &amp; restore</CardTitle>
            <CardDescription>
              Download a copy of your data, or put a backup back after a mistake
              or when moving to a new database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BackupCard />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Market holidays</CardTitle>
            <CardDescription>
              Weekdays when NSE and BSE are closed. Live prices and the daily
              snapshot skip these days.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {"error" in holidays ? (
              <StatusRow
                ok={false}
                label="Holidays unavailable"
                detail={`Run the market holidays migration (see README). ${holidays.error}`}
              />
            ) : (
              <>
                <HolidayList holidays={holidays.value} />
                <HolidayForm />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-2">
        <ComingSoon
          stage={9}
          title="Telegram settings"
          items={[
            "Connect the Telegram bot",
            "Quiet hours and which alerts are on",
          ]}
        />
      </div>
    </>
  )
}
