import type { NextRequest } from "next/server"

import { isAuthorizedCronRequest } from "@/lib/cron"
import { formatQuantity } from "@/lib/format"
import { runJob } from "@/lib/jobs/run"
import { importMutualFunds } from "@/lib/mutual-funds/import"
import { createAdminClient } from "@/lib/supabase/admin"

// Downloads a ~1.5 MB file and saves about 14,000 funds.
export const maxDuration = 120

/** Called by Vercel Cron on weekday nights, after AMFI publishes NAVs (see vercel.json). */
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
  const outcome = await runJob(supabase, "mf-nav", async () => {
    const { funds, navsUpdated, deactivated } =
      await importMutualFunds(supabase)
    return {
      status: "success",
      summary: `${formatQuantity(funds)} funds · ${formatQuantity(navsUpdated)} new NAVs · ${formatQuantity(deactivated)} marked inactive`,
    }
  })
  return Response.json(outcome, {
    status: outcome.status === "failed" ? 500 : 200,
  })
}
