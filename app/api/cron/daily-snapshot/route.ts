import type { NextRequest } from "next/server"

import { isAuthorizedCronRequest } from "@/lib/cron"
import { runDailySnapshot } from "@/lib/jobs/daily-snapshot"
import { runJob } from "@/lib/jobs/run"
import { createAdminClient } from "@/lib/supabase/admin"

// Fetching closing prices and saving snapshots takes a few seconds.
export const maxDuration = 60

/** Called by Vercel Cron on weekdays after the market closes (see vercel.json). */
export async function GET(request: NextRequest) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createAdminClient()
  const outcome = await runJob(supabase, "daily-snapshot", () =>
    runDailySnapshot(supabase),
  )
  return Response.json(outcome, {
    status: outcome.status === "failed" ? 500 : 200,
  })
}
