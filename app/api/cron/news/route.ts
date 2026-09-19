import type { NextRequest } from "next/server"

import { isAuthorizedCronRequest } from "@/lib/cron"
import { runJob } from "@/lib/jobs/run"
import { refreshNews } from "@/lib/news/refresh"
import { createAdminClient } from "@/lib/supabase/admin"

// Searches stop starting after 40 seconds (see lib/news/refresh.ts).
export const maxDuration = 60

/** Called by Vercel Cron every morning (see vercel.json). */
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
  const outcome = await runJob(supabase, "news", async () => {
    const summary = await refreshNews(supabase, { maxAgeMinutes: 60 })
    const parts = [
      `${summary.searched} of ${summary.stocks} stocks searched`,
      `${summary.articles} headlines`,
    ]
    if (summary.failed > 0) parts.push(`${summary.failed} failed`)
    if (summary.postponed > 0) parts.push(`${summary.postponed} left for later`)
    return {
      status:
        summary.searched > 0 && summary.failed === summary.searched
          ? "failed"
          : "success",
      summary: parts.join(" · "),
      error: summary.firstError,
    }
  })
  return Response.json(outcome, {
    status: outcome.status === "failed" ? 500 : 200,
  })
}
