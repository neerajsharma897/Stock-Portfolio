import type { NextRequest } from "next/server"

import { isAuthorizedCronRequest } from "@/lib/cron"
import { importCoinList } from "@/lib/crypto/coindcx"
import { runJob } from "@/lib/jobs/run"
import { createAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 60

/** Called by Vercel Cron every Monday morning (see vercel.json). */
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
  const outcome = await runJob(supabase, "coin-list", async () => {
    const { coins, deactivated } = await importCoinList(supabase)
    return {
      status: "success",
      summary: `${coins} coins · ${deactivated} marked inactive`,
    }
  })
  return Response.json(outcome, {
    status: outcome.status === "failed" ? 500 : 200,
  })
}
