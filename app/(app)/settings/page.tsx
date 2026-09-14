import type { Metadata } from "next"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

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
import { formatDate } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Settings" }

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

export default async function SettingsPage() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: owner, error } = await supabase
    .from("app_owner")
    .select("display_name, timezone, created_at")
    .maybeSingle()

  return (
    <>
      <PageHeader title="Settings" description="Account and setup status." />

      <div className="grid gap-4 md:grid-cols-2">
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
              Checks that Stage 1 is set up correctly.
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
      </div>

      <div className="mt-4">
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
