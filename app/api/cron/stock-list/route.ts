import type { NextRequest } from "next/server"

import { isAuthorizedCronRequest } from "@/lib/cron"
import { formatQuantity } from "@/lib/format"
import { importInstruments } from "@/lib/instruments/import"
import { runJob } from "@/lib/jobs/run"
import { createAdminClient } from "@/lib/supabase/admin"

// Downloads a ~33 MB file and saves thousands of rows. 300 seconds is the
// Vercel free plan's maximum.
export const maxDuration = 300

/** Called by Vercel Cron on Mondays before the market opens (see vercel.json). */
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
  const outcome = await runJob(supabase, "stock-list", async () => {
    const { imported, deactivated } = await importInstruments(supabase)
    return {
      status: "success",
      summary: `${formatQuantity(imported)} entries saved · ${formatQuantity(deactivated)} marked inactive`,
    }
  })
  return Response.json(outcome, {
    status: outcome.status === "failed" ? 500 : 200,
  })
}
