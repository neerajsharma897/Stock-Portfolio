import type { Metadata } from "next"

import { deleteAlertRule } from "@/app/(app)/alerts/actions"
import { PauseAlertButton } from "@/app/(app)/alerts/alert-rule-buttons"
import { AlertRuleDialog } from "@/app/(app)/alerts/alert-rule-dialog"
import { PreferencesForm } from "@/app/(app)/alerts/preferences-form"
import { TelegramCard } from "@/app/(app)/alerts/telegram-card"
import { DeleteButton } from "@/components/delete-button"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { describeRule } from "@/lib/alerts/rules"
import {
  getTelegramSettings,
  listAlertEvents,
  listAlertRules,
} from "@/lib/data/alerts"
import { formatINR } from "@/lib/format"
import { getTelegramToken } from "@/lib/telegram/client"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Alerts" }

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
})

const EVENT_LABELS: Record<string, string> = {
  price: "Price",
  summary: "Summary",
  system: "Problem",
  test: "Test",
}

/** Telegram's HTML formatting, removed for showing a message as plain text. */
function plainText(html: string) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

export default async function AlertsPage() {
  const [settings, rules, events] = await Promise.all([
    getTelegramSettings(),
    listAlertRules(),
    listAlertEvents(30),
  ])
  const tokenSet = getTelegramToken() !== null

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Telegram messages for price moves, the daily close and problems."
      />

      <div className="grid gap-2 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Telegram</CardTitle>
            <CardDescription>Where the alerts are sent.</CardDescription>
          </CardHeader>
          <CardContent>
            {tokenSet ? (
              <TelegramCard chatName={settings?.chat_name ?? null} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Add the bot token from @BotFather as TELEGRAM_BOT_TOKEN in
                .env.local (and in Vercel), then restart the app. See README.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What to send</CardTitle>
            <CardDescription>
              Summary, problem alerts and quiet hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PreferencesForm
              dailySummary={settings?.daily_summary ?? true}
              systemAlerts={settings?.system_alerts ?? true}
              quietStart={settings?.quiet_start.slice(0, 5) ?? "22:00"}
              quietEnd={settings?.quiet_end.slice(0, 5) ?? "07:00"}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Price alerts</CardTitle>
            <CardDescription>
              {rules.length === 0
                ? "Targets, stop-losses, big daily moves and 52-week highs or lows."
                : `${rules.length} ${rules.length === 1 ? "alert" : "alerts"}. Each fires at most once a day.`}
            </CardDescription>
            <CardAction>
              <AlertRuleDialog />
            </CardAction>
          </CardHeader>
          {rules.length > 0 && (
            <CardContent>
              <ul className="divide-y">
                {rules.map((rule) => {
                  const label = `${rule.instrument.symbol} ${describeRule(rule).toLowerCase()}`
                  return (
                    <li
                      key={rule.id}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm first:pt-0 last:pb-0"
                    >
                      <div className="grid min-w-0 gap-0.5">
                        <p
                          className={cn(
                            "flex flex-wrap items-center gap-2",
                            !rule.isActive && "text-muted-foreground",
                          )}
                        >
                          <span className="font-medium">
                            {rule.instrument.symbol}
                          </span>
                          <span>{describeRule(rule)}</span>
                          {!rule.isActive && (
                            <Badge variant="outline">Paused</Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {rule.instrument.exchange}
                          {rule.lastPrice !== null &&
                            ` · now ${formatINR(rule.lastPrice)}`}
                          {rule.lastTriggeredAt &&
                            ` · last sent ${timeFormatter.format(new Date(rule.lastTriggeredAt))}`}
                          {rule.note && ` · ${rule.note}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <PauseAlertButton
                          ruleId={rule.id}
                          active={rule.isActive}
                          label={label}
                        />
                        <DeleteButton
                          label={`Delete alert: ${label}`}
                          title="Delete this alert?"
                          description={`${label} won't be watched any more.`}
                          action={deleteAlertRule.bind(null, rule.id)}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent alerts</CardTitle>
            <CardDescription>
              The last 30, sent or held back. Kept for 90 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="divide-y">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="grid gap-1 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant={event.delivered ? "secondary" : "outline"}
                      >
                        {EVENT_LABELS[event.kind] ?? event.kind}
                      </Badge>
                      {timeFormatter.format(new Date(event.sent_at))}
                      {!event.delivered && (
                        <span className="text-destructive">
                          Not sent: {event.error}
                        </span>
                      )}
                    </p>
                    <p className="whitespace-pre-line">
                      {plainText(event.message)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>How often prices are checked</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground">
            <p>
              While the dashboard, a member page or the watchlist is open in
              market hours, price alerts are checked every minute. The daily
              summary goes out once after the close, between 3:30 and 4:30 PM.
            </p>
            <p>
              To get price alerts with the app closed, set up a free scheduler
              such as cron-job.org to call{" "}
              <code className="rounded bg-muted px-1 text-foreground">
                https://&lt;your site&gt;/api/cron/alerts
              </code>{" "}
              every 5 minutes, Monday to Friday, 9:15 AM to 3:45 PM India time,
              with the header{" "}
              <code className="rounded bg-muted px-1 text-foreground">
                Authorization: Bearer &lt;CRON_SECRET&gt;
              </code>
              . Steps are in the README.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
