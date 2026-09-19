import type { NextRequest } from "next/server"

import { runAlertsJob } from "@/lib/alerts/run"
import { isAuthorizedCronRequest } from "@/lib/cron"
import { runJob } from "@/lib/jobs/run"
import { createAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 60

/**
 * Checks price alerts and sends the daily summary. Vercel calls it once after
 * the close (see vercel.json); an external scheduler can call it every few
 * minutes in market hours with the same Authorization header (see README).
 */
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
  const outcome = await runJob(supabase, "alerts", () => runAlertsJob(supabase))
  return Response.json(outcome, {
    status: outcome.status === "failed" ? 500 : 200,
  })
}
